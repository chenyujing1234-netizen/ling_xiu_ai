#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
申请通知发信。路径与 /home/chenyj/http_server_src/email_helper.py 一致：

  smtplib.SMTP_SSL('smtp.qq.com', 465)
  login(SENDER_EMAIL, SMTP_PASSWORD)
  send_message(...)

用法：
  python3 scripts/send_mail.py --verify
  python3 scripts/send_mail.py --send   # stdin 为 JSON：{"to","subject","text"}
"""
from __future__ import annotations

import argparse
import json
import os
import smtplib
import sys
from email.header import Header
from email.mime.text import MIMEText
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTTP_SERVER_ENV = Path('/home/chenyj/http_server_src/.env')


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        # 已在环境里的（Next 注入的）优先；空字符串当作没配，允许用文件补上
        if key and not os.environ.get(key):
            os.environ[key] = value


def load_env() -> None:
    load_env_file(ROOT / '.env.local')
    load_env_file(ROOT / '.env')
    # 与 http_server_src 共用同一套 QQ 邮箱配置（若那边有 .env）
    load_env_file(HTTP_SERVER_ENV)


def credentials() -> tuple[str, str, str, int]:
    load_env()
    user = (os.environ.get('SENDER_EMAIL') or '').strip()
    password = (os.environ.get('SMTP_PASSWORD') or '').strip()
    host = (os.environ.get('SMTP_HOST') or os.environ.get('SMTP_SERVER') or 'smtp.qq.com').strip()
    port = int(os.environ.get('SMTP_PORT') or 465)
    return user, password, host, port


def connect(user: str, password: str, host: str, port: int) -> smtplib.SMTP_SSL:
    # 与 email_helper.py / debug_smtp.py 完全一致
    server = smtplib.SMTP_SSL(host, port, timeout=30)
    server.login(user, password)
    return server


def send_message(to: str, subject: str, text: str) -> None:
    user, password, host, port = credentials()
    if not user or not password:
        raise SystemExit('missing SENDER_EMAIL / SMTP_PASSWORD')
    msg = MIMEText(text, 'plain', 'utf-8')
    msg['Subject'] = Header(subject, 'utf-8')
    msg['From'] = user
    msg['To'] = to
    server = connect(user, password, host, port)
    try:
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:
            pass


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--send', action='store_true')
    args = parser.parse_args()

    user, password, host, port = credentials()
    if not user or not password:
        print('missing SENDER_EMAIL / SMTP_PASSWORD', file=sys.stderr)
        return 2

    if args.verify:
        server = connect(user, password, host, port)
        try:
            server.quit()
        except Exception:
            pass
        print(f'ok {host}:{port} as {user}')
        return 0

    if args.send:
        payload = json.loads(sys.stdin.read() or '{}')
        to = (payload.get('to') or os.environ.get('ADMIN_NOTIFY_EMAIL') or '594462206@qq.com').strip()
        subject = payload['subject']
        text = payload['text']
        send_message(to, subject, text)
        print(f'ok -> {to}')
        return 0

    parser.print_help()
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
