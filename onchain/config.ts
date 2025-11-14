import { http, createConfig } from 'wagmi'
import { arbitrum, arbitrumSepolia } from 'wagmi/chains'

// Get environment variables
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

export const config = createConfig({
    chains: [arbitrum, arbitrumSepolia],
    transports: {
        [arbitrum.id]: http(),
        [arbitrumSepolia.id]: http(),
    },
})

export const metadata = {
    name: 'Weather Markets',
    description: 'Predict weather outcomes on Arbitrum',
    url: 'https://weather.markets',
    icons: ['https://weather.markets/icon.png']
}

export const arbitrumChainId = {
    mainnet: 42161,
    testnet: 421614
}
