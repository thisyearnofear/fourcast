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
 emerald: 'bg-accent/20 text-accent border-accent/30',
 slate: 'bg-[var(--color-ink-faint)]/20 text-[var(--color-ink-muted)] border-[var(--color-ink-faint)]/30',
 };

 return (
 <span className={`px-3 py-1 text-xs font-light border ${colorMap[chain.color] || colorMap.emerald}`}>
 {chain.icon} {chain.name}
 {chain.legacy && <span className="ml-1 opacity-60">(legacy)</span>}
 </span>
 );
}

export function ConfidenceBadge({ confidence, isNight }) {
 const baseClass = 'px-3 py-1 text-xs font-light border';
 const colorMap = {
 HIGH: 'bg-accent/20 text-accent border-accent/30',
 MEDIUM: 'bg-sealed/20 text-sealed border-sealed/30',
 LOW: 'bg-breach/20 text-breach border-breach/30',
 default: 'bg-[var(--color-ink-faint)]/20 text-[var(--color-ink-muted)] border-[var(--color-ink-faint)]/30'
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
 <span className={`px-3 py-1 text-xs font-light border ${getQualityBgColor(quality, isNight)} ${getQualityColor(quality, isNight)} border-current/30`}>
 {getQualityLabel(quality)} ({Math.round(quality)})
 </span>
 );
}

export function EfficiencyBadge({ efficiency, isNight }) {
 const colorMap = {
 INEFFICIENT: 'bg-sealed/20 text-sealed border-sealed/30',
 EFFICIENT: 'bg-accent/20 text-accent border-accent/30'
 };

 return (
 <span className={`px-3 py-1 text-xs font-light border ${colorMap[efficiency]}`}>
 {efficiency}
 </span>
 );
}

export function OnChainBadge({ txHash, isNight }) {
 return (
 <span className={`px-3 py-1 text-xs font-light border bg-accent/20 text-accent border-accent/30`}>On-chain: {typeof txHash === 'string' ? txHash.substring(0, 8) : ''}...
 </span>
 );
}
