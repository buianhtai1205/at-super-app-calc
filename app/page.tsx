'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, RefreshCw, TrendingDown, TrendingUp, Calculator, AlertCircle, ShoppingCart, Wallet } from 'lucide-react';

export default function BitcoinCalculator() {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');

  // Buy States
  const [usdtP2pBuy, setUsdtP2pBuy] = useState<number | ''>(25500);
  const [btcP2pBuy, setBtcP2pBuy] = useState<number | ''>(1700000000);

  // Sell States
  const [usdtP2pSell, setUsdtP2pSell] = useState<number | ''>(25400);
  const [btcP2pSell, setBtcP2pSell] = useState<number | ''>(1690000000);

  const [btcUsdt, setBtcUsdt] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | ''>(0.1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchP2P = async (asset: 'USDT' | 'BTC', tradeType: 'BUY' | 'SELL') => {
    try {
      const res = await fetch('/api/p2p', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiat: "VND",
          page: 1,
          rows: 5,
          tradeType: tradeType,
          asset: asset,
          countries: [],
          proMerchantAds: false,
          shieldMerchantAds: false,
          filterType: "tradable",
          periods: [],
          additionalKycVerifyFilter: 0,
          publisherType: "merchant",
          payTypes: [],
          classifies: ["mass", "profession", "fiat_trade"],
          tradedWith: false,
          followed: false,
          transAmount: 20000000
        })
      });
      const data = await res.json();
      if (data && data.data && data.data.length > 0) {
        const prices = data.data.map((item: any) => parseFloat(item.adv.price));
        if (tradeType === 'SELL') {
          // Merchant selling, user buying -> User wants lowest price
          return Math.min(...prices);
        } else {
          // Merchant buying, user selling -> User wants highest price
          return Math.max(...prices);
        }
      }
    } catch (error) {
      console.error(`Error fetching P2P ${asset} ${tradeType}:`, error);
    }
    return null;
  };

  const fetchAllPrices = useCallback(async () => {
    setIsFetching(true);
    try {
      const [
        spotRes,
        usdtBuyPrice,
        btcBuyPrice,
        usdtSellPrice,
        btcSellPrice
      ] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT').then(res => res.json()).catch(() => null),
        fetchP2P('USDT', 'SELL'), // User buys -> Merchant sells
        fetchP2P('BTC', 'SELL'),  // User buys -> Merchant sells
        fetchP2P('USDT', 'BUY'),  // User sells -> Merchant buys
        fetchP2P('BTC', 'BUY')    // User sells -> Merchant buys
      ]);

      if (spotRes && spotRes.price) setBtcUsdt(parseFloat(spotRes.price));
      if (usdtBuyPrice) setUsdtP2pBuy(usdtBuyPrice);
      if (btcBuyPrice) setBtcP2pBuy(btcBuyPrice);
      if (usdtSellPrice) setUsdtP2pSell(usdtSellPrice);
      if (btcSellPrice) setBtcP2pSell(btcSellPrice);

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching prices:', error);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchAllPrices();
  }, [fetchAllPrices]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchAllPrices();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAllPrices]);

  // Calculations
  const spotFeeRate = 0.001; // 0.1%
  const validBtcUsdt = btcUsdt || 0;
  const validAmount = Number(amount) > 0 ? Number(amount) : 0;

  // --- BUY LOGIC ---
  const validUsdtP2pBuy = Number(usdtP2pBuy) > 0 ? Number(usdtP2pBuy) : 0;
  const validBtcP2pBuy = Number(btcP2pBuy) > 0 ? Number(btcP2pBuy) : 0;
  const buyMethod1PricePerBtc = validUsdtP2pBuy * validBtcUsdt * (1 + spotFeeRate);
  const buyMethod2PricePerBtc = validBtcP2pBuy;
  const buyMethod1Total = buyMethod1PricePerBtc * validAmount;
  const buyMethod2Total = buyMethod2PricePerBtc * validAmount;
  const buyDiffTotal = buyMethod2Total - buyMethod1Total;
  const isBuyMethod1Better = buyDiffTotal > 0; // Cheaper is better
  const buyDiffPercent = buyMethod2Total > 0 ? (Math.abs(buyDiffTotal) / buyMethod2Total) * 100 : 0;
  const buyBreakEvenBtcUsdt = (validUsdtP2pBuy > 0) ? validBtcP2pBuy / (validUsdtP2pBuy * (1 + spotFeeRate)) : 0;

  // --- SELL LOGIC ---
  const validUsdtP2pSell = Number(usdtP2pSell) > 0 ? Number(usdtP2pSell) : 0;
  const validBtcP2pSell = Number(btcP2pSell) > 0 ? Number(btcP2pSell) : 0;
  const sellMethod1PricePerBtc = validUsdtP2pSell * validBtcUsdt * (1 - spotFeeRate);
  const sellMethod2PricePerBtc = validBtcP2pSell;
  const sellMethod1Total = sellMethod1PricePerBtc * validAmount;
  const sellMethod2Total = sellMethod2PricePerBtc * validAmount;
  const sellDiffTotal = sellMethod1Total - sellMethod2Total;
  const isSellMethod1Better = sellDiffTotal > 0; // Higher revenue is better
  const sellDiffPercent = sellMethod2Total > 0 ? (Math.abs(sellDiffTotal) / sellMethod2Total) * 100 : 0;
  const sellBreakEvenBtcUsdt = (validUsdtP2pSell > 0) ? validBtcP2pSell / (validUsdtP2pSell * (1 - spotFeeRate)) : 0;

  // --- CURRENT MODE VARIABLES ---
  const isBuy = mode === 'buy';
  const method1Total = isBuy ? buyMethod1Total : sellMethod1Total;
  const method2Total = isBuy ? buyMethod2Total : sellMethod2Total;
  const method1PricePerBtc = isBuy ? buyMethod1PricePerBtc : sellMethod1PricePerBtc;
  const method2PricePerBtc = isBuy ? buyMethod2PricePerBtc : sellMethod2PricePerBtc;
  const isMethod1Better = isBuy ? isBuyMethod1Better : isSellMethod1Better;
  const diffTotal = isBuy ? Math.abs(buyDiffTotal) : Math.abs(sellDiffTotal);
  const diffPercent = isBuy ? buyDiffPercent : sellDiffPercent;
  const breakEvenBtcUsdt = isBuy ? buyBreakEvenBtcUsdt : sellBreakEvenBtcUsdt;
  const currentUsdtP2p = isBuy ? validUsdtP2pBuy : validUsdtP2pSell;

  // Formatters
  const formatVND = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  const formatUSDT = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val).replace('$', '') + ' USDT';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="w-6 h-6 text-indigo-600" />
              So sánh chi phí {isBuy ? 'Mua' : 'Bán'} Bitcoin
            </h1>
            <p className="text-slate-500 text-sm mt-1">Tìm phương án tối ưu nhất giữa P2P trực tiếp và gián tiếp qua USDT</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <button
               onClick={fetchAllPrices}
               disabled={isFetching}
               className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-70"
             >
               <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
               Đồng bộ dữ liệu
             </button>
             <div className="flex items-center gap-2 text-sm bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <span className="relative flex h-3 w-3">
                  {autoRefresh && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${autoRefresh ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                </span>
                <span className="text-slate-600 font-medium">Auto-refresh (5s)</span>
                <button 
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`ml-2 px-3 py-1 rounded-full text-xs font-bold transition-colors ${autoRefresh ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                >
                  {autoRefresh ? 'TẮT' : 'BẬT'}
                </button>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inputs */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
              
              {/* Mode Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setMode('buy')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${isBuy ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  MUA BTC
                </button>
                <button
                  onClick={() => setMode('sell')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${!isBuy ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Wallet className="w-4 h-4" />
                  BÁN BTC
                </button>
              </div>

              <h2 className="font-semibold text-lg border-b pb-3 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-slate-400" />
                Dữ liệu {isBuy ? 'Mua' : 'Bán'}
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giá {isBuy ? 'Mua' : 'Bán'} USDT (P2P VND)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={isBuy ? usdtP2pBuy : usdtP2pSell} 
                    onChange={(e) => isBuy ? setUsdtP2pBuy(e.target.value ? Number(e.target.value) : '') : setUsdtP2pSell(e.target.value ? Number(e.target.value) : '')}
                    className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                    placeholder="VD: 25500"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 text-sm font-medium">VND</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Giá {isBuy ? 'Mua' : 'Bán'} BTC (P2P VND)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={isBuy ? btcP2pBuy : btcP2pSell} 
                    onChange={(e) => isBuy ? setBtcP2pBuy(e.target.value ? Number(e.target.value) : '') : setBtcP2pSell(e.target.value ? Number(e.target.value) : '')}
                    className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                    placeholder="VD: 1700000000"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 text-sm font-medium">VND</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Số lượng BTC muốn {isBuy ? 'mua' : 'bán'}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
                    placeholder="VD: 0.1"
                    step="0.01"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 text-sm font-medium">BTC</span>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-indigo-900">Giá BTC/USDT (Binance)</span>
                  <button onClick={fetchAllPrices} className="text-indigo-600 hover:text-indigo-800 p-1.5 rounded-md hover:bg-indigo-100 transition-colors">
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="text-2xl font-bold text-indigo-700">
                  {btcUsdt ? formatUSDT(btcUsdt) : 'Đang tải...'}
                </div>
                {lastUpdated && (
                  <div className="text-xs text-indigo-600/70 mt-1 font-medium">
                    Cập nhật: {lastUpdated.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Method 1 Card */}
              <div className={`p-6 rounded-2xl border-2 transition-all relative overflow-hidden ${isMethod1Better ? 'border-emerald-500 bg-emerald-50/30 shadow-sm' : 'border-slate-200 bg-white'}`}>
                {isMethod1Better && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Phương án 1</h3>
                    <p className="text-sm text-slate-500 font-medium mt-0.5">
                      {isBuy ? 'Mua USDT P2P → Mua BTC Spot' : 'Bán BTC Spot → Bán USDT P2P'}
                    </p>
                  </div>
                  {isMethod1Better && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">Tối ưu hơn</span>}
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-slate-500 font-medium mb-1">
                      {isBuy ? 'Tổng chi phí (tạm tính)' : 'Tổng thu về (tạm tính)'}
                    </div>
                    <div className={`text-3xl font-bold tracking-tight ${isMethod1Better ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {formatVND(method1Total)}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100/80 text-sm space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Giá 1 BTC:</span>
                      <span className="font-semibold text-slate-700">{formatVND(method1PricePerBtc)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Phí giao dịch Spot:</span>
                      <span className="font-semibold text-slate-700">0.1%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Method 2 Card */}
              <div className={`p-6 rounded-2xl border-2 transition-all relative overflow-hidden ${!isMethod1Better ? 'border-emerald-500 bg-emerald-50/30 shadow-sm' : 'border-slate-200 bg-white'}`}>
                {!isMethod1Better && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">Phương án 2</h3>
                    <p className="text-sm text-slate-500 font-medium mt-0.5">
                      {isBuy ? 'Mua trực tiếp BTC trên P2P' : 'Bán trực tiếp BTC trên P2P'}
                    </p>
                  </div>
                  {!isMethod1Better && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">Tối ưu hơn</span>}
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-slate-500 font-medium mb-1">
                      {isBuy ? 'Tổng chi phí (tạm tính)' : 'Tổng thu về (tạm tính)'}
                    </div>
                    <div className={`text-3xl font-bold tracking-tight ${!isMethod1Better ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {formatVND(method2Total)}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100/80 text-sm space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Giá 1 BTC:</span>
                      <span className="font-semibold text-slate-700">{formatVND(method2PricePerBtc)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Phí giao dịch:</span>
                      <span className="font-semibold text-slate-700">Đã bao gồm</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison Summary */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-lg mb-5">Kết luận so sánh</h3>
              
              <div className="flex items-center gap-5 p-5 rounded-xl bg-slate-50 border border-slate-100 mb-6">
                <div className={`p-4 rounded-full shadow-sm ${isMethod1Better ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                  {isMethod1Better ? <TrendingDown className="w-7 h-7" /> : <TrendingUp className="w-7 h-7" />}
                </div>
                <div>
                  <div className="text-slate-600 font-medium">
                    Phương án <strong className="text-slate-900">{isMethod1Better ? '1 (Gián tiếp)' : '2 (Trực tiếp)'}</strong> đang {isBuy ? 'rẻ hơn' : 'lời hơn'}
                  </div>
                  <div className="text-2xl font-bold mt-1 tracking-tight">
                    <span className={isMethod1Better ? 'text-emerald-600' : 'text-rose-600'}>
                      {formatVND(Math.abs(diffTotal))}
                    </span>
                    <span className="text-base font-semibold text-slate-500 ml-2">
                      ({diffPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Threshold Analysis */}
              <div className="bg-indigo-50/60 p-6 rounded-xl border border-indigo-100/80">
                <h4 className="flex items-center gap-2 font-bold text-indigo-900 mb-3">
                  <AlertCircle className="w-5 h-5 text-indigo-600" />
                  Phân tích điểm hòa vốn (Threshold Analysis)
                </h4>
                <p className="text-sm text-indigo-800/80 leading-relaxed font-medium">
                  Với giá USDT P2P hiện tại là <strong className="text-indigo-900">{formatVND(currentUsdtP2p)}</strong>, để phương án 1 ({isBuy ? 'mua' : 'bán'} gián tiếp) có lợi hơn phương án 2, giá BTC/USDT trên sàn Binance phải <strong>{isBuy ? 'thấp hơn' : 'cao hơn'}</strong> mức:
                </p>
                <div className="mt-4 text-3xl font-bold text-indigo-700 tracking-tight">
                  {formatUSDT(breakEvenBtcUsdt)}
                </div>
                <p className="text-xs text-indigo-600/70 mt-3 font-medium">
                  * Đã bao gồm 0.1% phí giao dịch Spot.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
