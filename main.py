"""
main.py
Server FastAPI cho game "Vua Tiếng Việt" - Multiplayer thời gian thực.
Sử dụng WebSockets để đồng bộ trạng thái game giữa các người chơi.
"""

import json
import random
import asyncio
import time
import os
import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

import game_data

app = FastAPI(title="Vua Tiếng Việt Game Server")
app.mount("/static", StaticFiles(directory="static"), name="static")

HIGH_SCORES_FILE = "high_scores.json"

def load_high_scores() -> List[Dict]:
    if os.path.exists(HIGH_SCORES_FILE):
        try:
            with open(HIGH_SCORES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_high_scores(scores: List[Dict]):
    try:
        with open(HIGH_SCORES_FILE, "w", encoding="utf-8") as f:
            json.dump(scores, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving high scores: {e}")

def update_high_scores(player_name: str, score: int, r3_score: int = 0) -> bool:
    """Cập nhật người chơi vào Bảng Vàng Kỷ Lục Top 10."""
    if score <= 0:
        return False
    
    scores = load_high_scores()
    
    if score >= 25:
        title = "👑 Vua Tiếng Việt"
    elif score >= 15:
        title = "🥈 Á Quân Kỷ Lục"
    else:
        title = "🥉 Dấu Ấn Vòng 3"
        
    date_str = datetime.datetime.now().strftime("%d/%m/%Y")
    
    existing = next((item for item in scores if item["name"] == player_name), None)
    if existing:
        if score > existing.get("score", 0):
            existing["score"] = score
            existing["r3_score"] = max(r3_score, existing.get("r3_score", 0))
            existing["date"] = date_str
            existing["title"] = title
    else:
        scores.append({
            "name": player_name,
            "score": score,
            "r3_score": r3_score,
            "date": date_str,
            "title": title
        })
        
    scores.sort(key=lambda x: (x.get("score", 0), x.get("r3_score", 0)), reverse=True)
    scores = scores[:10]
    
    save_high_scores(scores)
    return any(s["name"] == player_name for s in scores)


# =============================================================================
# DATA MODELS
# =============================================================================

class Player:
    """Đại diện cho một người chơi trong phòng."""
    def __init__(self, client_id: str, name: str, websocket: WebSocket):
        self.client_id = client_id
        self.name = name
        self.websocket = websocket
        self.score: int = 0
        self.is_eliminated: bool = False
        self.is_spectator: bool = False
        self.last_answer_time: float = time.time()  # Dùng để phân tích hòa điểm
        self.streak: int = 0
        self.sabotage_cards: List[str] = []
        self.frozen_until: float = 0.0
        self.dusted_until: float = 0.0
        self.used_lifelines: List[str] = []


class RoomState:
    """Trạng thái của một phòng chơi."""

    VALID_STATES = ["LOBBY", "ROUND_1", "ROUND_2", "SPECIAL_ROUND", "GAME_OVER"]

    def __init__(self, room_id: str):
        self.room_id = room_id
        self.state: str = "LOBBY"
        self.players: Dict[str, Player] = {}
        self.started_as_multiplayer: bool = False
        # Câu hỏi được random cho mỗi ván
        self.round_1_questions: List[Dict] = []
        self.round_2_questions: List[Dict] = []
        self.special_questions: List[Dict] = []
        # Trạng thái vòng 2
        self.current_question_index: int = 0
        self.buzzer_locked_by: Optional[str] = None  # client_id nắm giữ buzzer
        self.buzzer_wrong_players: List[str] = []  # Đã bấm sai trong câu này
        # Trạng thái vòng đặc biệt
        self.special_phase: int = 1  # 1 hoặc 2
        self.special_index: int = 0

    def reset_scores(self):
        """Reset điểm về 0 cho tất cả người chơi chưa bị loại."""
        for player in self.players.values():
            if not player.is_eliminated:
                player.score = 0
                player.streak = 0
                player.sabotage_cards = []
                player.frozen_until = 0.0
                player.dusted_until = 0.0
                player.used_lifelines = []

    def get_active_players(self) -> List[Player]:
        """Trả về danh sách người chơi chưa bị loại."""
        return [p for p in self.players.values() if not p.is_eliminated]

    def eliminate_lowest_scorer(self) -> Optional[str]:
        """
        Loại người chơi có điểm thấp nhất trong số người chưa bị loại.
        Nếu hòa điểm: loại người hoàn thành câu hỏi cuối chậm nhất (last_answer_time lớn nhất).
        Trả về tên người bị loại hoặc None nếu không có ai.
        """
        active = self.get_active_players()
        if len(active) <= 1:
            return None
        # Sắp xếp: điểm thấp nhất trước, nếu bằng nhau thì thời gian chậm hơn (lớn hơn) trước
        sorted_players = sorted(active, key=lambda p: (p.score, -p.last_answer_time))
        loser = sorted_players[0]
        loser.is_eliminated = True
        loser.is_spectator = True
        return loser.name

    def get_leaderboard(self) -> List[Dict]:
        """Trả về bảng xếp hạng."""
        sorted_players = sorted(
            self.players.values(),
            key=lambda p: (p.score, -p.last_answer_time),
            reverse=True
        )
        return [
            {
                "name": p.name,
                "score": p.score,
                "is_eliminated": p.is_eliminated,
                "is_spectator": p.is_spectator,
            }
            for p in sorted_players
        ]


# =============================================================================
# CONNECTION MANAGER
# =============================================================================

class ConnectionManager:
    """Quản lý tất cả các kết nối WebSocket theo phòng."""

    def __init__(self):
        self.rooms: Dict[str, RoomState] = {}

    def get_or_create_room(self, room_id: str) -> RoomState:
        if room_id not in self.rooms:
            self.rooms[room_id] = RoomState(room_id)
        return self.rooms[room_id]

    async def connect(self, room_id: str, client_id: str, name: str, websocket: WebSocket):
        await websocket.accept()
        room = self.get_or_create_room(room_id)

        # Loại bỏ các kết nối cũ có cùng TÊN người chơi hoặc cùng client_id
        duplicate_ids = [cid for cid, p in list(room.players.items()) if p.name.strip().lower() == name.strip().lower() or cid == client_id]
        for cid in duplicate_ids:
            old_player = room.players.pop(cid, None)
            if old_player and old_player.websocket:
                try:
                    await old_player.websocket.close()
                except Exception:
                    pass

        player = Player(client_id=client_id, name=name, websocket=websocket)
        room.players[client_id] = player
        return room

    def disconnect(self, room_id: str, client_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].players.pop(client_id, None)
            if not self.rooms[room_id].players:
                del self.rooms[room_id]

    async def broadcast_to_room(self, room: RoomState, message: Dict):
        """Gửi tin nhắn JSON đến tất cả người chơi trong phòng."""
        payload = json.dumps(message, ensure_ascii=False)
        disconnected = []
        for client_id, player in room.players.items():
            try:
                await player.websocket.send_text(payload)
            except Exception:
                disconnected.append(client_id)
        for cid in disconnected:
            room.players.pop(cid, None)

    async def send_to_player(self, player: Player, message: Dict):
        """Gửi tin nhắn riêng đến một người chơi cụ thể."""
        payload = json.dumps(message, ensure_ascii=False)
        try:
            await player.websocket.send_text(payload)
        except Exception:
            pass


manager = ConnectionManager()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def prepare_round_1(room: RoomState):
    """Chuẩn bị câu hỏi ngẫu nhiên cho Vòng 1."""
    questions = random.sample(game_data.round_1_questions, min(14, len(game_data.round_1_questions)))
    room.round_1_questions = questions
    room.reset_scores()


def prepare_round_2(room: RoomState):
    """Chuẩn bị câu hỏi ngẫu nhiên cho Vòng 2."""
    raw = random.sample(game_data.round_2_questions, min(9, len(game_data.round_2_questions)))
    processed = []
    for q in raw:
        words = q["original"].split()
        shuffled = words[:]
        random.shuffle(shuffled)
        # Đảm bảo không giống thứ tự gốc
        while shuffled == words and len(words) > 1:
            random.shuffle(shuffled)
        processed.append({
            "original": q["original"],
            "shuffled": shuffled,
            "answer": q["original"]
        })
    room.round_2_questions = processed
    room.current_question_index = 0
    room.buzzer_locked_by = None
    room.buzzer_wrong_players = []
    room.reset_scores()


def prepare_special_round(room: RoomState):
    """Chuẩn bị vòng đặc biệt."""
    room.special_questions = game_data.special_round_questions[:]
    room.special_index = 0
    room.special_phase = 1


def generate_peek(answer: str) -> str:
    if len(answer) <= 2:
        return answer
    res = [answer[0]]
    for char in answer[1:-1]:
        if char == " ":
            res.append(" ")
        else:
            res.append("_")
    res.append(answer[-1])
    return "".join(res)


LIFELINE_LIMITS = {
    "50_50": 7,
    "PEEK": 3,
    "SCRAMBLE": 3,
    "FIRST_WORD": 3,
    "LAST_WORD": 3,
    "REVEAL_PAIR": 3,
    "VERIFY_PROGRESS": 3,
    "SKIP_QUESTION": 3,
    "PEEK_SPECIAL": 3,
    "50_50_SPECIAL": 3
}

async def handle_use_lifeline(room: RoomState, player: Player, lifeline_type: str, extra_data: Dict):
    if player.is_eliminated:
        return
    max_uses = LIFELINE_LIMITS.get(lifeline_type, 3)
    if player.used_lifelines.count(lifeline_type) >= max_uses:
        return  # Đã sử dụng hết số lần tối đa cho phép
    
    if room.state == "ROUND_1":
        if lifeline_type == "PEEK":
            q_idx = extra_data.get("question_index", 0)
            if 0 <= q_idx < len(room.round_1_questions):
                ans = room.round_1_questions[q_idx]["answer"]
                peek_text = generate_peek(ans)
                player.used_lifelines.append(lifeline_type)
                await manager.send_to_player(player, {
                    "type": "LIFELINE_RESULT",
                    "lifeline": "PEEK",
                    "data": peek_text,
                    "question_index": q_idx
                })
        elif lifeline_type == "SCRAMBLE":
            q_idx = extra_data.get("question_index", 0)
            if 0 <= q_idx < len(room.round_1_questions):
                ans = room.round_1_questions[q_idx]["answer"]
                letters = [c.upper() for c in ans if c != " "]
                random.shuffle(letters)
                player.used_lifelines.append(lifeline_type)
                await manager.send_to_player(player, {
                    "type": "LIFELINE_RESULT",
                    "lifeline": "SCRAMBLE",
                    "data": letters,
                    "question_index": q_idx
                })
        elif lifeline_type == "50_50":
            q_idx = extra_data.get("question_index", 0)
            if 0 <= q_idx < len(room.round_1_questions):
                ans = room.round_1_questions[q_idx]["answer"]
                wrong_options = [q["answer"] for q in game_data.round_1_questions if q["answer"].strip().lower() != ans.strip().lower()]
                wrong_ans = random.choice(wrong_options) if wrong_options else "Đáp án khác"
                options = [ans, wrong_ans]
                random.shuffle(options)
                player.used_lifelines.append(lifeline_type)
                await manager.send_to_player(player, {
                    "type": "LIFELINE_RESULT",
                    "lifeline": "50_50",
                    "data": options,
                    "correct": ans,
                    "question_index": q_idx
                })
                
    elif room.state == "ROUND_2":
        if room.buzzer_locked_by != player.client_id:
            return  # Only the buzzer holder can use lifelines
        q = room.round_2_questions[room.current_question_index]
        words = q["answer"].split()
        if lifeline_type == "FIRST_WORD":
            first_word = words[0]
            player.used_lifelines.append(lifeline_type)
            await manager.send_to_player(player, {
                "type": "LIFELINE_RESULT",
                "lifeline": "FIRST_WORD",
                "data": first_word
            })
        elif lifeline_type == "LAST_WORD":
            last_word = words[-1]
            player.used_lifelines.append(lifeline_type)
            await manager.send_to_player(player, {
                "type": "LIFELINE_RESULT",
                "lifeline": "LAST_WORD",
                "data": last_word
            })
        elif lifeline_type == "REVEAL_PAIR":
            if len(words) >= 2:
                idx = random.randint(0, len(words) - 2)
                pair = [words[idx], words[idx + 1]]
            else:
                pair = words[:]
            player.used_lifelines.append(lifeline_type)
            await manager.send_to_player(player, {
                "type": "LIFELINE_RESULT",
                "lifeline": "REVEAL_PAIR",
                "data": pair
            })
        elif lifeline_type == "VERIFY_PROGRESS":
            current = extra_data.get("current_words", [])
            result = [current[i].lower() == words[i].lower() if i < len(current) else False for i in range(len(current))]
            player.used_lifelines.append(lifeline_type)
            await manager.send_to_player(player, {
                "type": "LIFELINE_RESULT",
                "lifeline": "VERIFY_PROGRESS",
                "data": result
            })
        elif lifeline_type == "SKIP_QUESTION":
            player.used_lifelines.append(lifeline_type)
            # Move to next question just for this player (server advances global index)
            room.current_question_index += 1
            await send_round2_question(room)
                
    elif room.state == "SPECIAL_ROUND":
        if lifeline_type == "PEEK_SPECIAL":
            q = room.special_questions[room.special_index]
            keyword = q["keyword"]
            reveal_index = random.randint(0, len(keyword) - 1)
            player.used_lifelines.append(lifeline_type)
            await manager.send_to_player(player, {
                "type": "LIFELINE_RESULT",
                "lifeline": "PEEK_SPECIAL",
                "reveal_index": reveal_index,
                "reveal_char": keyword[reveal_index]
            })
        elif lifeline_type == "50_50_SPECIAL":
            q = room.special_questions[room.special_index]
            keyword = q["keyword"]
            wrong_options = [x["keyword"] for x in game_data.special_round_questions if x["keyword"].upper() != keyword.upper()]
            wrong_ans = random.choice(wrong_options) if wrong_options else "KHAC"
            options = [keyword, wrong_ans]
            random.shuffle(options)
            player.used_lifelines.append(lifeline_type)
            await manager.send_to_player(player, {
                "type": "LIFELINE_RESULT",
                "lifeline": "50_50_SPECIAL",
                "data": options,
                "correct": keyword
            })


async def handle_use_sabotage(room: RoomState, player: Player, card_type: str, target_id: str):
    if player.is_eliminated:
        return
    if card_type not in player.sabotage_cards:
        return  # Không có thẻ này
        
    # Xử lý thẻ ADD_TIME khi chơi đơn
    if card_type == "ADD_TIME":
        player.sabotage_cards.remove(card_type)
        await manager.send_to_player(player, {
            "type": "SABOTAGE_TRIGGERED",
            "card": "ADD_TIME",
            "from_name": player.name,
            "target_id": player.client_id,
            "target_name": player.name,
        })
        return

    # Đối với các thẻ khác, tìm target
    target = room.players.get(target_id)
    if not target or target.is_eliminated:
        return
        
    player.sabotage_cards.remove(card_type)
    
    if card_type == "FREEZE":
        target.frozen_until = time.time() + 5.0
        await manager.broadcast_to_room(room, {
            "type": "SABOTAGE_TRIGGERED",
            "card": "FREEZE",
            "from_name": player.name,
            "target_id": target.client_id,
            "target_name": target.name,
            "duration": 5
        })
    elif card_type == "TIME_THIEF":
        # Trừ 10 giây nạn nhân, cộng 5 giây cho thủ phạm
        await manager.broadcast_to_room(room, {
            "type": "SABOTAGE_TRIGGERED",
            "card": "TIME_THIEF",
            "from_name": player.name,
            "target_id": target.client_id,
            "target_name": target.name
        })
        # Gửi sự kiện thay đổi thời gian cho nạn nhân
        await manager.send_to_player(target, {
            "type": "SABOTAGE_EFFECT",
            "card": "TIME_THIEF",
            "change": -10
        })
        # Gửi sự kiện thay đổi thời gian cho thủ phạm
        await manager.send_to_player(player, {
            "type": "SABOTAGE_EFFECT",
            "card": "TIME_THIEF_BENEFIT",
            "change": 5
        })
    elif card_type == "CHALK_DUST":
        target.dusted_until = time.time() + 7.0
        await manager.broadcast_to_room(room, {
            "type": "SABOTAGE_TRIGGERED",
            "card": "CHALK_DUST",
            "from_name": player.name,
            "target_id": target.client_id,
            "target_name": target.name,
            "duration": 7
        })
        await manager.send_to_player(target, {
            "type": "SABOTAGE_EFFECT",
            "card": "CHALK_DUST",
            "duration": 7
        })


async def handle_send_emote(room: RoomState, player: Player, emote: str, target_id: str):
    if player.is_eliminated:
        return
    target = room.players.get(target_id)
    if not target:
        return
    
    # Gửi tin nhắn đến target để bay lên màn hình họ
    await manager.send_to_player(target, {
        "type": "EMOTE_RECEIVED",
        "emote": emote,
        "from_name": player.name
    })
    
    # Broadcast cho cả phòng để hiện nhật ký emote
    await manager.broadcast_to_room(room, {
        "type": "EMOTE_LOG",
        "from_name": player.name,
        "to_name": target.name,
        "emote": emote
    })


# =============================================================================
# GAME LOGIC HANDLERS
# =============================================================================

async def check_and_handle_only_one_connected(room: RoomState) -> bool:
    """
    Nếu game đang diễn ra (đã bắt đầu dưới dạng nhiều người chơi) và chỉ còn 1 người chơi kết nối trong phòng,
    cho người đó thắng ngay lập tức.
    """
    if room.state in ["ROUND_1", "ROUND_2", "SPECIAL_ROUND"] and room.started_as_multiplayer:
        if len(room.players) == 1:
            winner = list(room.players.values())[0]
            room.state = "GAME_OVER"
            await manager.broadcast_to_room(room, {
                "type": "GAME_OVER",
                "leaderboard": room.get_leaderboard(),
                "message": f"Tất cả đối thủ đã rời phòng. {winner.name} giành chiến thắng chung cuộc!",
            })
            return True
    return False


async def handle_start_game(room: RoomState):
    """Xử lý sự kiện bắt đầu game - chuyển sang Vòng 1."""
    room.state = "ROUND_1"
    room.started_as_multiplayer = len(room.players) > 1
    prepare_round_1(room)
    await manager.broadcast_to_room(room, {
        "type": "GAME_START",
        "round": 1,
        "questions": room.round_1_questions,
        "duration": 90,
        "message": "Vòng 1: Phản xạ bắt đầu! Trả lời càng nhiều câu càng tốt trong 90 giây."
    })


async def handle_round1_submit(room: RoomState, player: Player, score: int, is_correct: bool = True):
    """Người chơi gửi điểm số cập nhật từ Vòng 1."""
    player.score = score
    player.last_answer_time = time.time()
    
    if is_correct:
        player.streak += 1
        if player.streak > 0 and player.streak % 3 == 0:
            if room.started_as_multiplayer:
                card = random.choice(["FREEZE", "TIME_THIEF", "CHALK_DUST"])
                msg_text = f"🔥 Combo x{player.streak}! Bạn nhận được thẻ phá hoại: {card}"
            else:
                card = "ADD_TIME"
                msg_text = f"🔥 Combo x{player.streak}! Bạn nhận được thẻ cộng 5 giây!"
            player.sabotage_cards.append(card)
            await manager.send_to_player(player, {
                "type": "SABOTAGE_CARD_RECEIVED",
                "card": card,
                "streak": player.streak,
                "message": msg_text
            })
    else:
        player.streak = 0

    await manager.broadcast_to_room(room, {
        "type": "SCORE_UPDATE",
        "leaderboard": room.get_leaderboard()
    })


async def handle_round1_finish(room: RoomState):
    """Tất cả người chơi đã hoàn thành Vòng 1 hoặc hết giờ."""
    eliminated_name = room.eliminate_lowest_scorer()
    await manager.broadcast_to_room(room, {
        "type": "ROUND_END",
        "round": 1,
        "eliminated": eliminated_name,
        "leaderboard": room.get_leaderboard(),
        "message": f"Vòng 1 kết thúc! {'Người bị loại: ' + eliminated_name if eliminated_name else 'Tất cả tiếp tục!'}"
    })
    await asyncio.sleep(4)
    # Chuyển sang Vòng 2
    room.state = "ROUND_2"
    prepare_round_2(room)
    await send_round2_question(room)


async def send_round2_question(room: RoomState):
    """Gửi câu hỏi hiện tại của Vòng 2."""
    if room.current_question_index >= len(room.round_2_questions):
        await handle_round2_finish(room)
        return
    q = room.round_2_questions[room.current_question_index]
    room.buzzer_locked_by = None
    room.buzzer_wrong_players = []
    await manager.broadcast_to_room(room, {
        "type": "ROUND2_QUESTION",
        "index": room.current_question_index + 1,
        "total": len(room.round_2_questions),
        "shuffled_words": q["shuffled"],
        "correct_words": q["answer"].split(),
        "duration": 30,
    })


async def handle_buzz(room: RoomState, player: Player):
    """Người chơi bấm chuông trong Vòng 2."""
    if time.time() < player.frozen_until:
        return  # Đang bị đóng băng, không được bấm chuông
    if room.buzzer_locked_by is not None:
        return  # Đã có người khóa rồi
    if player.client_id in room.buzzer_wrong_players:
        return  # Đã sai rồi, không được bấm lại
    if player.is_eliminated:
        return
    room.buzzer_locked_by = player.client_id
    await manager.broadcast_to_room(room, {
        "type": "BUZZ_LOCKED",
        "by_id": player.client_id,
        "by_name": player.name,
    })


async def handle_round2_answer(room: RoomState, player: Player, answer: str):
    """Người chơi trả lời câu hỏi Vòng 2."""
    if time.time() < player.frozen_until:
        return  # Đang bị đóng băng, không được trả lời
    if room.buzzer_locked_by != player.client_id:
        return
    q = room.round_2_questions[room.current_question_index]
    correct = answer.strip().lower() == q["answer"].strip().lower()
    if correct:
        player.score += 1
        player.last_answer_time = time.time()
        player.streak += 1
        
        # Thưởng thẻ bài khi đạt chuỗi đúng x2 ở Vòng 2
        if player.streak > 0 and player.streak % 2 == 0:
            if room.started_as_multiplayer:
                card = random.choice(["FREEZE", "TIME_THIEF", "CHALK_DUST"])
                msg_text = f"🔥 Combo x{player.streak}! Bạn nhận được thẻ phá hoại: {card}"
            else:
                card = "ADD_TIME"
                msg_text = f"🔥 Combo x{player.streak}! Bạn nhận được thẻ cộng 5 giây!"
            player.sabotage_cards.append(card)
            await manager.send_to_player(player, {
                "type": "SABOTAGE_CARD_RECEIVED",
                "card": card,
                "streak": player.streak,
                "message": msg_text
            })
            
        await manager.broadcast_to_room(room, {
            "type": "ROUND2_RESULT",
            "correct": True,
            "correct_answer": q["answer"],
            "by_name": player.name,
            "leaderboard": room.get_leaderboard(),
        })
        # Kiểm tra thắng sớm (5 điểm)
        if player.score >= 5:
            await handle_round2_finish(room)
            return
        room.current_question_index += 1
        await asyncio.sleep(2)
        await send_round2_question(room)
    else:
        player.streak = 0
        room.buzzer_wrong_players.append(player.client_id)
        room.buzzer_locked_by = None
        await manager.broadcast_to_room(room, {
            "type": "ROUND2_RESULT",
            "correct": False,
            "by_name": player.name,
            "message": "Sai! Người chơi khác có thể bấm chuông."
        })


async def handle_round2_timeout(room: RoomState):
    """Hết giờ câu hỏi Vòng 2 - chuyển sang câu tiếp theo."""
    if room.state != "ROUND_2":
        return
    q = room.round_2_questions[room.current_question_index]
    await manager.broadcast_to_room(room, {
        "type": "ROUND2_TIMEOUT",
        "correct_answer": q["answer"],
    })
    room.current_question_index += 1
    await asyncio.sleep(2)
    await send_round2_question(room)


async def handle_round2_finish(room: RoomState):
    """Kết thúc Vòng 2."""
    eliminated_name = room.eliminate_lowest_scorer()
    await manager.broadcast_to_room(room, {
        "type": "ROUND_END",
        "round": 2,
        "eliminated": eliminated_name,
        "leaderboard": room.get_leaderboard(),
        "message": f"Vòng 2 kết thúc! {'Người bị loại: ' + eliminated_name if eliminated_name else ''}"
    })
    await asyncio.sleep(4)
    # Chuyển sang Vòng Đặc biệt
    room.state = "SPECIAL_ROUND"
    prepare_special_round(room)
    await send_special_question(room)


async def send_special_question(room: RoomState):
    """Gửi câu hỏi Vòng Đặc biệt."""
    if room.special_index >= len(room.special_questions):
        await handle_game_over(room)
        return
    q = room.special_questions[room.special_index]
    room.special_phase = 1
    # Xác định người chơi còn lại (không bị loại)
    active_players = room.get_active_players()
    active_ids = [p.client_id for p in active_players]
    await manager.broadcast_to_room(room, {
        "type": "SPECIAL_QUESTION",
        "index": room.special_index + 1,
        "length": q["length"],
        "clue": q["clue_1"],
        "phase": 1,
        "duration": 15,
        "active_players": active_ids,
    })


async def handle_special_answer(room: RoomState, player: Player, answer: str):
    """Xử lý câu trả lời Vòng Đặc biệt."""
    if player.is_eliminated:
        return
    if time.time() < player.frozen_until:
        return  # Đang bị đóng băng, không được trả lời
    q = room.special_questions[room.special_index]
    # Chuẩn hóa: bỏ dấu cách và so sánh không phân biệt hoa thường
    normalized_answer = answer.strip().upper().replace(" ", "")
    normalized_keyword = q["keyword"].upper().replace(" ", "")
    correct = normalized_answer == normalized_keyword

    reward = 100 if room.special_phase == 1 else 50
    if correct:
        player.score += reward
        player.last_answer_time = time.time()
        await manager.broadcast_to_room(room, {
            "type": "SPECIAL_RESULT",
            "correct": True,
            "by_name": player.name,
            "reward": reward,
            "keyword": q["keyword"],
            "leaderboard": room.get_leaderboard(),
        })
        room.special_index += 1
        await asyncio.sleep(3)
        await send_special_question(room)
    else:
        await manager.send_to_player(player, {
            "type": "SPECIAL_RESULT",
            "correct": False,
            "message": "Sai rồi! Hãy thử lại."
        })


async def handle_special_phase2(room: RoomState):
    """Chuyển sang giai đoạn 2 của Vòng Đặc biệt (lật 1 chữ cái)."""
    if room.state != "SPECIAL_ROUND":
        return
    q = room.special_questions[room.special_index]
    room.special_phase = 2
    # Chọn ngẫu nhiên 1 vị trí để tiết lộ
    keyword = q["keyword"]
    reveal_index = random.randint(0, len(keyword) - 1)
    await manager.broadcast_to_room(room, {
        "type": "SPECIAL_PHASE2",
        "clue": q["clue_2"],
        "reveal_index": reveal_index,
        "reveal_char": keyword[reveal_index],
        "duration": 15,
    })


async def handle_special_timeout(room: RoomState):
    """Hết giờ Vòng Đặc biệt - không ai trả lời đúng."""
    if room.state != "SPECIAL_ROUND":
        return
    q = room.special_questions[room.special_index]
    await manager.broadcast_to_room(room, {
        "type": "SPECIAL_TIMEOUT",
        "keyword": q["keyword"],
        "message": "Hết giờ! Không ai trả lời đúng.",
    })
    room.special_index += 1
    await asyncio.sleep(3)
    await send_special_question(room)


async def handle_game_over(room: RoomState):
    """Kết thúc game và hiển thị kết quả cuối cùng."""
    room.state = "GAME_OVER"
    leaderboard = room.get_leaderboard()
    
    # Cập nhật High Scores cho tất cả người chơi có điểm > 0
    new_record = False
    for p in room.players.values():
        if p.score > 0:
            if update_high_scores(p.name, p.score):
                new_record = True

    await manager.broadcast_to_room(room, {
        "type": "GAME_OVER",
        "leaderboard": leaderboard,
        "high_scores": load_high_scores(),
        "new_record": new_record,
        "message": "Trò chơi kết thúc! Cảm ơn tất cả đã tham gia.",
    })


async def handle_restart(room: RoomState):
    """Reset phòng để chơi lại."""
    for player in room.players.values():
        player.score = 0
        player.is_eliminated = False
        player.is_spectator = False
    room.state = "LOBBY"
    await manager.broadcast_to_room(room, {
        "type": "LOBBY_UPDATE",
        "players": [{"name": p.name, "id": p.client_id} for p in room.players.values()],
        "high_scores": load_high_scores(),
        "message": "Đã reset phòng! Sẵn sàng cho ván tiếp theo."
    })


# =============================================================================
# MAIN WEBSOCKET ENDPOINT
# =============================================================================

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    name = websocket.query_params.get("name", f"Player_{client_id[:4]}")
    room = await manager.connect(room_id, client_id, name, websocket)

    # Thông báo lobby cập nhật cho tất cả mọi người
    await manager.broadcast_to_room(room, {
        "type": "LOBBY_UPDATE",
        "players": [{"name": p.name, "id": p.client_id} for p in room.players.values()],
        "message": f"{name} đã vào phòng!",
        "high_scores": load_high_scores()
    })

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            action = msg.get("action")
            player = room.players.get(client_id)
            if not player:
                break

            # --- Lobby ---
            if action == "START_GAME":
                if room.state == "LOBBY":
                    await handle_start_game(room)

            elif action == "LEAVE_ROOM":
                manager.disconnect(room_id, client_id)
                if room_id in manager.rooms:
                    remaining_room = manager.rooms[room_id]
                    if not await check_and_handle_only_one_connected(remaining_room):
                        await manager.broadcast_to_room(remaining_room, {
                            "type": "LOBBY_UPDATE",
                            "players": [{"name": p.name, "id": p.client_id} for p in remaining_room.players.values()],
                            "message": f"{name} đã rời phòng.",
                            "high_scores": load_high_scores()
                        })
                break

            elif action == "SURRENDER":
                if not player.is_eliminated:
                    player.is_eliminated = True
                    player.is_spectator = True
                    await manager.broadcast_to_room(room, {
                        "type": "PLAYER_SURRENDERED",
                        "player_id": client_id,
                        "player_name": player.name,
                        "message": f"🏳️ {player.name} đã xin đầu hàng ván đấu này!",
                        "leaderboard": room.get_leaderboard()
                    })
                    if room.state == "ROUND_2" and room.buzzer_locked_by == client_id:
                        room.buzzer_locked_by = None
                        await manager.broadcast_to_room(room, {
                            "type": "BUZZ_RESET",
                            "message": "Buzzer đã được mở lại do người chơi đầu hàng."
                        })
                    active = room.get_active_players()
                    if len(active) <= 1:
                        await handle_game_over(room)
                    else:
                        await check_and_handle_only_one_connected(room)

            # --- Vòng 1 ---
            elif action == "ROUND1_SCORE":
                if room.state == "ROUND_1":
                    await handle_round1_submit(room, player, msg.get("score", 0), msg.get("is_correct", True))

            elif action == "ROUND1_FINISH":
                if room.state == "ROUND_1":
                    await handle_round1_finish(room)

            # --- Vòng 2 ---
            elif action == "BUZZ":
                if room.state == "ROUND_2":
                    await handle_buzz(room, player)

            elif action == "ROUND2_ANSWER":
                if room.state == "ROUND_2":
                    await handle_round2_answer(room, player, msg.get("answer", ""))

            elif action == "ROUND2_TIMEOUT":
                if room.state == "ROUND_2":
                    await handle_round2_timeout(room)

            # --- Vòng Đặc biệt ---
            elif action == "SPECIAL_ANSWER":
                if room.state == "SPECIAL_ROUND":
                    await handle_special_answer(room, player, msg.get("answer", ""))

            elif action == "SPECIAL_PHASE2":
                if room.state == "SPECIAL_ROUND":
                    await handle_special_phase2(room)

            elif action == "SPECIAL_TIMEOUT":
                if room.state == "SPECIAL_ROUND":
                    await handle_special_timeout(room)

            # --- Quyền trợ giúp / Phá hoại ---
            elif action == "USE_LIFELINE":
                await handle_use_lifeline(room, player, msg.get("type", ""), msg.get("extra", {}))

            elif action == "USE_SABOTAGE":
                await handle_use_sabotage(room, player, msg.get("card", ""), msg.get("target_id", ""))

            elif action == "SEND_EMOTE":
                await handle_send_emote(room, player, msg.get("emote", ""), msg.get("target_id", ""))

            # --- Kết thúc ---
            elif action == "RESTART":
                await handle_restart(room)

    except WebSocketDisconnect:
        manager.disconnect(room_id, client_id)
        if room_id in manager.rooms:
            remaining_room = manager.rooms[room_id]
            if not await check_and_handle_only_one_connected(remaining_room):
                await manager.broadcast_to_room(remaining_room, {
                    "type": "LOBBY_UPDATE",
                    "players": [{"name": p.name, "id": p.client_id} for p in remaining_room.players.values()],
                    "message": f"{name} đã rời phòng.",
                    "high_scores": load_high_scores()
                })


# =============================================================================
# ROOT & API ENDPOINTS
# =============================================================================

@app.get("/api/high-scores")
async def get_high_scores():
    """Trả về Bảng Vàng Kỷ Lục Top 10."""
    return load_high_scores()


@app.get("/")
async def root():
    """Redirect đến trang game chính."""
    with open("static/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())
