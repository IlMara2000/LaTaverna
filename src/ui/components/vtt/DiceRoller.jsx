import React from 'react';
import { rollDice } from '../../../lib/diceLogic';
import { useGameStore } from '../../../store/gameStore';

export default function DiceRoller({ username, sessionId }) {
    const diceList = [4, 6, 8, 10, 12, 20, 100];

    return (
        <div className="flex flex-wrap gap-2 p-2 bg-black/40 rounded-xl border border-white/5 shadow-inner">
            {diceList.map(d => (
                <button
                    key={d}
                    onClick={() => rollDice(d, 0, username, sessionId)}
                    className="flex-1 min-w-[40px] h-10 bg-amber-900/40 hover:bg-amber-700/60 border border-amber-500/30 rounded text-xs font-bold transition-all transform active:scale-95"
                >
                    d{d}
                </button>
            ))}
        </div>
    );
}
