import Link from 'next/link';

export function Navbar({ trustScore = 100 }: { trustScore?: number }) {
  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 shadow-sm px-4 py-3 flex justify-between items-center">
      <Link href="/" className="font-bold text-xl text-green-600 tracking-tight">
        FuelOnGo
        <span className="text-xs ml-1 bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">AI</span>
      </Link>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full shadow-inner">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trust Score</span>
          <span className={`text-sm font-bold ${trustScore >= 40 ? 'text-green-600' : 'text-red-500'}`}>
            {trustScore}
          </span>
        </div>
        
        <Link href="/profile" className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-500 to-emerald-400 text-white flex items-center justify-center font-bold shadow-md hover:opacity-90 transition-opacity">
          U
        </Link>
      </div>
    </nav>
  );
}
