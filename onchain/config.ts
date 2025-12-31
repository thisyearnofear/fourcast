import { http, createConfig } from 'wagmi'
import { bsc, arbitrum, polygon } from 'wagmi/chains'

export const config = createConfig({
    chains: [arbitrum, bsc, polygon],
    transports: {
        [arbitrum.id]: http(process.env.ARB_RPC_URL),
        [bsc.id]: http(process.env.NEXT_PUBLIC_BNB_RPC_URL),
        [polygon.id]: http(process.env.POLYGON_RPC_URL),
    },
})

export const metadata = {
    name: 'Weather Markets',
    description: 'Predict weather outcomes on Arbitrum, BNB, Polygon',
    url: 'https://weather.markets',
    icons: ['https://weather.markets/icon.png']
}

export const bnbChainId = 56
export const arbitrumChainId = 42161
export const polygonChainId = 137
