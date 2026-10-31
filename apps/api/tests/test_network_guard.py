"""pytest-socket keeps the suite offline: only loopback and the test database host are allowed."""

import socket

import pytest
from pytest_socket import SocketConnectBlockedError


def test_outbound_network_is_blocked():
    with pytest.raises(SocketConnectBlockedError):
        socket.create_connection(("192.0.2.1", 80), timeout=1)
