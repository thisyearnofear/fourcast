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
        emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        slate: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-light border ${colorMap[chain.color] || colorMap.emerald}`}>
            {chain.icon} {chain.name}
            {chain.legacy && <span className="ml-1 opacity-60">(legacy)</span>}
        </span>
    );
}

export function ConfidenceBadge({ confidence, isNight }) {
    const baseClass = 'px-3 py-1 rounded-full text-xs font-light border';
    const colorMap = {
        HIGH: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        MEDIUM: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        LOW: 'bg-red-500/20 text-red-300 border-red-500/30',
        default: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
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
        INEFFICIENT: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        EFFICIENT: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-light border ${colorMap[efficiency]}`}>
            {efficiency}
        </span>
    );
}

export function OnChainBadge({ txHash, isNight }) {
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-light border bg-emerald-500/20 text-emerald-300 border-emerald-500/30`}>On-chain: {typeof txHash === 'string' ? txHash.substring(0, 8) : ''}...
                    </span>
    );
}
