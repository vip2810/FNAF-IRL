import { io, type Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';
import type { GameState, PublicConfig } from './types';

export const socket: Socket = io({ autoConnect: true });

export function useGame(): { state: GameState | null; config: PublicConfig | null } {
  const [state, setState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    const onState = (s: GameState) => setState(s);
    const onConfig = (c: PublicConfig) => setConfig(c);
    socket.on('state', onState);
    socket.on('config', onConfig);
    return () => {
      socket.off('state', onState);
      socket.off('config', onConfig);
    };
  }, []);

  return { state, config };
}
