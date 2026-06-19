#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
資金管理モンテカルロ・シミュレータ
====================================
「1万円バジェット」「10万円バジェット」それぞれで、ある戦略を続けたときの
  - 破産確率(ruin probability)
  - 資金推移の分布(中央値・上位/下位)
を数値で出す。"絶対に負けない"は不可能でも、"破産確率を限りなく0に近づける"
配分はこれで設計できる。

ポイント:
  - 期待回収率(payback)が1.0未満(=控除率を超える妙味が無い)なら、
    どんな賭け方でも長期では必ず資金は減る → シミュレーションで一目瞭然。
  - 妙味(payback>1.0)を取れる前提でも、1点の賭け額比率が大きいと破産する
    → フラットベットの賭け率を小さく保つことの意味が数字で分かる。
"""

import random
import statistics
from dataclasses import dataclass


@dataclass
class Strategy:
    name: str
    bankroll: int          # 開始資金
    bets_per_day: int      # 1日の賭け点数
    days: int              # 運用日数
    stake_fraction: float  # 1点あたり資金比(フラットベット)
    win_prob: float        # 1点の的中率
    odds: float            # 的中時の払戻倍率(単勝/複勝想定)
    ruin_threshold: float  # この割合まで減ったら破産扱い(例:0.2=8割溶けたら退場)


def simulate_once(s: Strategy) -> float:
    bankroll = float(s.bankroll)
    ruin_line = s.bankroll * s.ruin_threshold
    for _ in range(s.days):
        for _ in range(s.bets_per_day):
            stake = bankroll * s.stake_fraction
            if stake < 100:
                stake = min(100.0, bankroll)
            if random.random() < s.win_prob:
                bankroll += stake * (s.odds - 1.0)
            else:
                bankroll -= stake
            if bankroll <= ruin_line:
                return bankroll
    return bankroll


def run(s: Strategy, trials: int = 20000):
    finals = [simulate_once(s) for _ in range(trials)]
    ruin_line = s.bankroll * s.ruin_threshold
    ruined = sum(1 for f in finals if f <= ruin_line)
    profit = sum(1 for f in finals if f > s.bankroll)
    finals.sort()
    payback = s.win_prob * s.odds
    print(f"\n■ {s.name}")
    print(f"   開始資金 {s.bankroll:,}円 / {s.days}日 × {s.bets_per_day}点 / "
          f"1点 {s.stake_fraction*100:.1f}% / 的中率 {s.win_prob*100:.0f}% × "
          f"{s.odds}倍 (期待回収率 {payback:.2f})")
    print(f"   破産確率(資金{int(s.ruin_threshold*100)}%まで減少): {ruined/trials*100:5.1f}%")
    print(f"   プラス収支で終える確率           : {profit/trials*100:5.1f}%")
    print(f"   最終資金 中央値: {int(statistics.median(finals)):>9,}円   "
          f"下位5%: {int(finals[int(trials*0.05)]):>9,}円   "
          f"上位5%: {int(finals[int(trials*0.95)]):>9,}円")


if __name__ == "__main__":
    print("=" * 70)
    print(" 資金管理モンテカルロ (各2万試行)")
    print("=" * 70)

    # --- 比較1: 期待値マイナス(妙味なし)で買い続けるとどうなるか ---
    run(Strategy("【悪例】1万円・全レース買い・妙味なし(回収率0.80)",
                 bankroll=10_000, bets_per_day=10, days=20,
                 stake_fraction=0.10, win_prob=0.32, odds=2.5, ruin_threshold=0.2))

    # --- 比較2: 1万円・厳選・薄い妙味(回収率1.05)・フラット控えめ ---
    run(Strategy("【推奨】1万円・厳選2点/日・妙味あり(回収率1.05)",
                 bankroll=10_000, bets_per_day=2, days=20,
                 stake_fraction=0.05, win_prob=0.35, odds=3.0, ruin_threshold=0.2))

    # --- 比較3: 10万円・厳選・薄い妙味・フラット控えめ ---
    run(Strategy("【推奨】10万円・厳選3点/日・妙味あり(回収率1.05)",
                 bankroll=100_000, bets_per_day=3, days=20,
                 stake_fraction=0.04, win_prob=0.35, odds=3.0, ruin_threshold=0.3))

    # --- 比較4: 10万円・賭けすぎ(1点15%)で破産が増える例 ---
    run(Strategy("【危険】10万円・1点15%張り・妙味あり(回収率1.05)",
                 bankroll=100_000, bets_per_day=3, days=20,
                 stake_fraction=0.15, win_prob=0.35, odds=3.0, ruin_threshold=0.3))

    print("\n" + "=" * 70)
    print(" 教訓: ①回収率<1.0(妙味なし)は何をしても溶ける ②妙味があっても")
    print("       1点の賭け率が大きいほど破産する ③厳選×低比率フラットが生き残る")
    print("=" * 70)
