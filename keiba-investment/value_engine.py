#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
競馬「投資」期待値エンジン
================================
ギャンブルではなく投資として運用するための、感情を排した機械判定ツール。

考え方:
  - 馬券は買った瞬間に控除率(JRA約20〜30%)ぶん不利。
  - 「当てる」のではなく、自分の見積もり勝率 × オッズ > 1.0 (=オーバーレイ) の
    馬・券種だけに資金を配分する。
  - 賭け額はフラクショナル・ケリー(資金成長の最適比率の1/4など)で機械的に決める。
    フルケリーは振れが激しく破産確率が高いので使わない。

使い方:
  python3 value_engine.py            # サンプル(マーメイドS想定の架空データ)で実行
  あるいは horses のリストを当日の実データ(出走表/オッズ/自分の見積り勝率)に置き換える。
"""

from dataclasses import dataclass
from typing import List


# ---- 設定（当日ここだけ触ればよい） ---------------------------------------

BANKROLL = 100_000          # 当日の総資金(円)。1万円運用なら 10_000 に変える
DAILY_RISK_CAP = 0.12       # 当日投下できる総額の上限(資金比)。10万なら12%=1.2万
PER_BET_CAP = 0.06          # 1点あたりの上限(資金比)。連敗耐性のため低く保つ
KELLY_FRACTION = 0.25       # フラクショナル・ケリー係数(1/4ケリー推奨)
MIN_EDGE = 0.05             # この期待値超過(EV-1)未満は「妙味なし」で見送る
TAKEOUT = {                 # 参考: 各券種の控除率(期待値の底上げ判断に使う)
    "win": 0.20,            # 単勝
    "place": 0.20,         # 複勝
    "wide": 0.225,         # ワイド
    "trifecta": 0.275,     # 三連単
}


@dataclass
class Horse:
    num: int            # 馬番
    name: str           # 馬名
    win_odds: float     # 単勝オッズ(当日の確定オッズを入れる)
    my_win_prob: float  # 自分の見積もり勝率(0〜1)。←ここがあなたの仕事


# ---- ロジック --------------------------------------------------------------

def expected_value(prob: float, odds: float) -> float:
    """100円あたりの期待回収率。1.0で損益分岐、>1.0で期待値プラス。"""
    return prob * odds


def fractional_kelly_fraction(prob: float, odds: float, kelly: float) -> float:
    """フラクショナル・ケリーで求める投下比率(資金比)。マイナスなら0(=賭けない)。"""
    b = odds - 1.0            # ネットオッズ
    q = 1.0 - prob
    if b <= 0:
        return 0.0
    f_star = (b * prob - q) / b
    return max(0.0, f_star) * kelly


def recommend(horses: List[Horse], bankroll: int) -> list:
    """各馬の判定(BUY/SKIP)と推奨賭け額を返す。"""
    rows = []
    for h in horses:
        ev = expected_value(h.my_win_prob, h.win_odds)
        kelly_f = fractional_kelly_fraction(h.my_win_prob, h.win_odds, KELLY_FRACTION)
        # 上限でクリップ
        stake_f = min(kelly_f, PER_BET_CAP)
        raw_stake = bankroll * stake_f
        stake = int(round(raw_stake / 100.0)) * 100  # 100円単位に丸め
        buy = (ev - 1.0) >= MIN_EDGE and stake >= 100
        rows.append({
            "num": h.num, "name": h.name, "odds": h.win_odds,
            "prob": h.my_win_prob, "ev": ev,
            "kelly_pct": kelly_f * 100, "stake": stake if buy else 0,
            "verdict": "BUY " if buy else "skip",
        })
    return rows


def enforce_daily_cap(rows: list, bankroll: int) -> list:
    """当日総投下が上限を超えたら、EVの高い順に優先して上限内に収める。"""
    cap = bankroll * DAILY_RISK_CAP
    buys = sorted([r for r in rows if r["stake"] > 0], key=lambda r: -r["ev"])
    total = 0
    for r in buys:
        if total + r["stake"] > cap:
            allowed = int((cap - total) / 100) * 100
            r["stake"] = max(0, allowed)
            if r["stake"] == 0:
                r["verdict"] = "skip"  # 予算切れで見送り
        total += r["stake"]
    return rows


def print_report(rows: list, bankroll: int):
    print("=" * 74)
    print(f" 競馬投資 期待値レポート   資金: {bankroll:,}円   "
          f"当日上限: {int(bankroll*DAILY_RISK_CAP):,}円  "
          f"(1/{int(1/KELLY_FRACTION)}ケリー)")
    print("=" * 74)
    print(f"{'馬番':>3} {'馬名':<12} {'オッズ':>6} {'見積勝率':>7} "
          f"{'期待値':>6} {'ケリー%':>6} {'賭け額':>8}  判定")
    print("-" * 74)
    total = 0
    for r in sorted(rows, key=lambda r: -r["ev"]):
        total += r["stake"]
        print(f"{r['num']:>3} {r['name']:<12} {r['odds']:>6.1f} "
              f"{r['prob']*100:>6.1f}% {r['ev']:>6.2f} {r['kelly_pct']:>5.1f}% "
              f"{r['stake']:>7,}円  {r['verdict']}")
    print("-" * 74)
    print(f"{'当日投下合計':<40} {total:>7,}円  "
          f"(資金比 {total/bankroll*100:.1f}%)")
    print("=" * 74)
    print(" 注意: 期待値(EV)>1.05 のオーバーレイのみBUY。残りは『見送り』が正解。")
    print("       見積勝率はあなたが当日の馬場・馬体重・パドックで決める数字です。")


# ---- サンプル実行（架空データ。当日実データに差し替えて使う） ----------------

if __name__ == "__main__":
    # ※これは架空のサンプルです。6/20阪神の実データではありません。
    #   当日 JRAアプリの出走表・確定オッズを見て、win_odds と my_win_prob を入力してください。
    sample = [
        Horse(1,  "サンプルA",   3.2, 0.24),   # 1番人気だが市場(1/3.2=31%)が過剰→EV<1
        Horse(5,  "サンプルB",   8.5, 0.16),   # 中位人気・軽ハンデ前走好走→妙味
        Horse(8,  "サンプルC",  15.0, 0.05),   # 人気薄、勝率見積り低→見送り
        Horse(11, "サンプルD",   6.0, 0.20),   # 市場16.7%評価、自分20%→オーバーレイ
        Horse(14, "サンプルE",  22.0, 0.03),   # 宝くじ域、EV<1→見送り
    ]
    rows = recommend(sample, BANKROLL)
    rows = enforce_daily_cap(rows, BANKROLL)
    print_report(rows, BANKROLL)
