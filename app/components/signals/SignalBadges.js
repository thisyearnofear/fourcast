import { calculateSignalQuality, getQualityColor, getQualityBgColor, getQualityLabel } from '@/utils/signalScoring';
import { CHAINS } from '@/constants/appConstants';

export function ChainNetworkBadge({ signal, isNight }) {
    // Explicit chain origin detection (with fallback to tipping flag)
    let chain = CHAINS.APTOS;

    if (signal.chain_origin === 'MOVEMENT' || signal.has_tipping_enabled || signal.tipping_enabled) {
        chain = CHAINS.MOVEMENT;
    }

    const colorMap = {
        purple: isNight ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-400/20 text-purple-800 border-purple-400/30',
        amber: isNight ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-400/20 text-amber-800 border-amber-400/30'
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-light border ${colorMap[chain.color]}`}>
            {chain.icon} {chain.name}
            {chain.id === 'movement' && <span className="ml-1 text-amber-300">✨</span>}
        </span>
    );
}

export function ConfidenceBadge({ confidence, isNight }) {
    const baseClass = 'px-3 py-1 rounded-full text-xs font-light border';
    const colorMap = {
        HIGH: isNight ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-400/20 text-green-800 border-green-400/30',
        MEDIUM: isNight ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-yellow-400/20 text-yellow-800 border-yellow-400/30',
        LOW: isNight ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-400/20 text-red-800 border-red-400/30',
        default: isNight ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' : 'bg-gray-400/20 text-gray-800 border-gray-400/30'
    };

    return (
        <span className={`${baseClass} ${colorMap[confidence] || colorMap.default}`}>
            {confidence || 'UNKNOWN'}
        </span>
    );
}

export function QualityBadge({ signal, isNight }) {
    const quality = calculateSignalQuality(signal);
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-light border ${getQualityBgColor(quality, isNight)} ${getQualityColor(quality, isNight)} border-current/30`}>
            {getQualityLabel(quality)} ({Math.round(quality)})
        </span>
    );
}

export function EfficiencyBadge({ efficiency, isNight }) {
    const colorMap = {
        INEFFICIENT: isNight ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-orange-400/20 text-orange-800 border-orange-400/30',
        EFFICIENT: isNight ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-400/20 text-green-800 border-green-400/30'
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-light border ${colorMap[efficiency]}`}>
            {efficiency}
        </span>
    );
}

export function OnChainBadge({ txHash, isNight }) {
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-light border ${isNight ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-400/20 text-purple-800 border-purple-400/30'}`}>
            On-chain: {typeof txHash === 'string' ? txHash.substring(0, 8) : ''}...
        </span>
    );
}
