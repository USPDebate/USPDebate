'use client';
import { useState, useEffect } from 'react';
import Card, { SectionLabel } from '@/components/ui/Card';
import DrawView from '@/components/DrawView';
import { IconLayers } from '@/components/ui/Icons';
import { callAPICached } from '@/lib/api';

export default function DrawTab() {
  // undefined = carregando | null = sem draw | objeto = draw
  const [draw, setDraw] = useState(undefined);

  useEffect(() => {
    callAPICached('getDrawHojePublico', null, 30000)
      .then((d) => setDraw(d || null))
      .catch(() => setDraw(null));
  }, []);

  return (
    <Card style={{ animationDelay: '.05s' }}>
      <SectionLabel icon={IconLayers}>Draw de hoje</SectionLabel>

      {draw === undefined && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-28 rounded-xl2" />
          ))}
        </div>
      )}

      {draw === null && (
        <div className="text-center py-10 text-muted">
          <div className="text-sm font-semibold">O draw ainda não foi publicado.</div>
          <div className="text-xs mt-1">Aguarde o administrador publicar.</div>
        </div>
      )}

      {draw && <DrawView draw={draw} />}
    </Card>
  );
}
