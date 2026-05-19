'use client';
import { useState, useEffect } from 'react';
import { onToast } from '@/lib/toast';
import { IconCheck } from '@/components/ui/Icons';

const ESTILO = {
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
  info: 'bg-bordo text-white',
};

export default function Toaster() {
  const [lista, setLista] = useState([]);

  useEffect(() => onToast((t) => {
    setLista((c) => [...c, t]);
    setTimeout(() => setLista((c) => c.filter((x) => x.id !== t.id)), 3500);
  }), []);

  return (
    <div className="fixed top-4 inset-x-0 z-[200] flex flex-col items-center gap-2
      px-4 pointer-events-none">
      {lista.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl
            text-[13px] font-semibold max-w-sm ${ESTILO[t.tipo] || ESTILO.info}`}
          style={{ animation: 'toastIn .3s ease both' }}
        >
          {t.tipo === 'success' && (
            <IconCheck className="w-4 h-4 shrink-0" style={{ animation: 'checkPop .4s ease both' }} />
          )}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
