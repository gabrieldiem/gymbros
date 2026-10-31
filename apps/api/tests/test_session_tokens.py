"""Session tokens are random; their stored hash depends on the server secret."""

from services.session_tokens import SessionTokens


def test_new_tokens_are_unique_and_long():
    tokens = {SessionTokens.new_token() for _ in range(50)}
    assert len(tokens) == 50
    assert all(len(token) >= 43 for token in tokens)


def test_hash_is_stable_and_keyed():
    token = "abc"
    assert SessionTokens("k1").hash(token) == SessionTokens("k1").hash(token)
    assert SessionTokens("k1").hash(token) != SessionTokens("k2").hash(token)
    assert len(SessionTokens("k1").hash(token)) == 64
