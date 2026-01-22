import React from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Caption } from '../types';

interface StatsChartProps {
  captions: Caption[];
}

const StatsChart: React.FC<StatsChartProps> = ({ captions }) => {
  if (captions.length === 0) return null;

  // Calculate words per second for each segment
  const data = captions.map((c, i) => {
    const duration = c.end - c.start;
    const words = c.text.split(' ').length;
    const wps = duration > 0 ? (words / duration).toFixed(1) : 0;
    return {
      id: i + 1,
      wps: parseFloat(wps as string),
      text: c.text.substring(0, 20) + '...'
    };
  });

  return (
    <div className="mt-8 p-6 rounded-[2rem] bg-slate-900/30 border border-slate-800/60">
      <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6 px-2">Speech Density Analysis (Words/Sec)</h3>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis 
                dataKey="id" 
                tick={{ fill: '#475569', fontSize: 10 }} 
                tickLine={false}
                axisLine={false}
            />
            <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            <Bar dataKey="wps" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.wps > 3 ? '#ef4444' : entry.wps > 2 ? '#f59e0b' : '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsChart;