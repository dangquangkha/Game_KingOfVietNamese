import asyncio
import sys
sys.stdout.reconfigure(encoding='utf-8')

from main import app, manager, load_high_scores, update_high_scores, prepare_round_1, prepare_round_2, Player, RoomState, LIFELINE_LIMITS
from fastapi.testclient import TestClient

client = TestClient(app)

def test_http_routes():
    print("1. Testing HTTP Routes...")
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert "Vua Tiếng Việt" in res_root.text

    res_api = client.get("/api/high-scores")
    assert res_api.status_code == 200
    assert isinstance(res_api.json(), list)
    print("   -> PASS: HTTP / and /api/high-scores")

def test_game_logic_unit():
    print("2. Testing Game Logic & State Management...")
    room = manager.get_or_create_room("ROOM_TEST_999")
    assert room.room_id == "ROOM_TEST_999"
    assert room.state == "LOBBY"

    # Test Round 1 question generation
    prepare_round_1(room)
    assert len(room.round_1_questions) == 14
    for q in room.round_1_questions:
        assert "question" in q
        assert "answer" in q
    print("   -> PASS: Round 1 Questions Generator (14 questions)")

    # Test Round 2 question generation
    prepare_round_2(room)
    assert len(room.round_2_questions) == 9
    for q in room.round_2_questions:
        assert "original" in q
        assert "shuffled" in q
        assert "answer" in q
    print("   -> PASS: Round 2 Word Scramble Generator (9 questions)")

    # Test Surrender and Elimination
    p1 = Player("c1", "Khoa", None)
    p2 = Player("c2", "Nam", None)
    room.players = {"c1": p1, "c2": p2}

    assert len(room.get_active_players()) == 2
    p2.is_eliminated = True
    p2.is_spectator = True
    assert len(room.get_active_players()) == 1
    assert room.get_active_players()[0].name == "Khoa"
    print("   -> PASS: Surrender & Active Player Filtering")

def test_lifeline_limits_config():
    print("3. Testing Lifeline Limits Configuration...")
    assert LIFELINE_LIMITS["50_50"] == 7
    assert LIFELINE_LIMITS["PEEK"] == 3
    assert LIFELINE_LIMITS["SCRAMBLE"] == 3
    assert LIFELINE_LIMITS["FIRST_WORD"] == 3
    assert LIFELINE_LIMITS["LAST_WORD"] == 3
    assert LIFELINE_LIMITS["REVEAL_PAIR"] == 3
    assert LIFELINE_LIMITS["VERIFY_PROGRESS"] == 3
    assert LIFELINE_LIMITS["SKIP_QUESTION"] == 3
    assert LIFELINE_LIMITS["PEEK_SPECIAL"] == 3
    assert LIFELINE_LIMITS["50_50_SPECIAL"] == 3
    print("   -> PASS: Lifeline Limits Configured (50/50: 7 uses, all others: 3 uses)")

def test_websocket_single_connection():
    print("4. Testing WebSocket Single Connection & Handshake...")
    with client.websocket_connect("/ws/ROOM_WS/user1?name=Minh") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "LOBBY_UPDATE"
        assert len(msg["players"]) == 1
        assert msg["players"][0]["name"] == "Minh"
        assert "high_scores" in msg
    print("   -> PASS: WebSocket Connection & Handshake OK")

if __name__ == "__main__":
    print("==========================================")
    print("  AUTOMATED TEST SUITE FOR KINGOFVIETNAMESE")
    print("==========================================")
    test_http_routes()
    test_game_logic_unit()
    test_lifeline_limits_config()
    test_websocket_single_connection()
    print("\n==========================================")
    print("🎉 ALL 4 TEST SUITES PASSED SUCCESSFULLY (100%)!")
    print("==========================================")
