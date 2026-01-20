import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Search, ShieldCheck } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-pink-50">
      {/* Sticky Header */}
      <nav className="sticky top-0 z-50 bg-white shadow-md border-b border-pink-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <div className="bg-primary text-white p-2 rounded-full shadow-md shadow-pink-200">
                  <Heart size={20} fill="white" />
                </div>
                <span className="font-bold text-lg text-pink-600 tracking-tight">
                  อาสาชีวิตหมุนต่อได้
                </span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {!isAdmin && (
                <Link to="/" className="text-gray-400 hover:text-primary transition">
                  <Search size={24} />
                </Link>
              )}
               <Link to="/admin" className="text-gray-400 hover:text-pink-600 text-xs flex flex-col items-center transition">
                  <ShieldCheck size={16} />
                </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-4xl w-full mx-auto p-4">
        {children}
      </main>

      <footer className="bg-white py-6 mt-8 border-t border-pink-100">
        <div className="max-w-4xl mx-auto px-4 text-center text-gray-400 text-sm">
          <p>© {new Date().getFullYear() + 543} อาสาชีวิตหมุนต่อได้</p>
          <p className="mt-1">ร่วมสร้างสรรค์สังคมน่าอยู่ไปด้วยกัน</p>
        </div>
      </footer>
    </div>
  );
};