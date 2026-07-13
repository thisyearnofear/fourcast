import { calculateSignalQuality, getQualityColor, getQualityBgColor, getQualityLabel } from '@/utils/signalScoring';
import { CHAINS } from '@/constants/appConstants';

export function ChainNetworkBadge({ signal, isNight }) {
    // Keyed off chain_origin. ARC is the live publish chain; APTOS/MOVEMENT
    // are legacy display-only (historical rows still carry those origins).
    const originMap = {
        ARC: CHAINS.ARC,
        APTOS: CHAINS.APTOS,
        MOVEMENT: CHAINS.MOVEMENT,
    };
    const chain = originMap[signal.chain_origin] || CHAINS.ARC;

    const colorMap = {
        purple: isNight ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-400/20 text-purple-800 border-purple-400/30',
        amber: isNight ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-400/20 text-amber-800 border-amber-400/30',
        indigo: isNight ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-indigo-400/20 text-indigo-800 border-indigo-400/30',
        blue: isNight ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-400/20 text-blue-800 border-blue-400/30'
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-light border ${colorMap[chain.color] || colorMap.indigo}`}>
            {chain.icon} {chain.name}
            {chain.legacy && <span className="ml-1 opacity-60">(legacy)</span>}
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
    // Icons ensure confidence is not color-only — accessible to colorblind users
    const iconMap = {
        HIGH: '✅',
        MEDIUM: '⚠️',
        LOW: '❌',
        default: '❓'
    };

    // Plain-language hint for first-time users (matches GLOSSARY.confidence)
    const hintMap = {
        HIGH: 'High confidence — multiple strong sources agree',
        MEDIUM: 'Medium confidence — decent evidence, some uncertainty',
        LOW: 'Low confidence — thin or conflicting evidence',
    };

    return (
        <span
            className={`${baseClass} ${colorMap[confidence] || colorMap.default}`}
            title={hintMap[confidence] || 'Evidence strength behind this call'}
        >
            <span aria-hidden="true">{iconMap[confidence] || iconMap.default}</span>{' '}
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
