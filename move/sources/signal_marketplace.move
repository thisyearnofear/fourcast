module fourcast_addr::signal_marketplace {
    use std::string::String;
    use std::signer;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin; 
    use aptos_std::table::{Self, Table};

    /// Error codes
    const E_SIGNAL_ALREADY_EXISTS: u64 = 1;
    const E_REGISTRY_NOT_INITIALIZED: u64 = 2;
    const E_SIGNAL_NOT_FOUND: u64 = 3;
    const E_CANNOT_TIP_SELF: u64 = 4;

    struct Signal has store, drop, copy {
        event_id: String,
        market_title: String,
        venue: String,
        event_time: u64,
        market_snapshot_hash: String,
        weather_hash: String,
        ai_digest: String,
        confidence: String,
        odds_efficiency: String,
        author_address: address,
        timestamp: u64,
        total_tips: u64, // Track total tips received for this signal
    }

    struct MarketplaceRegistry has key {
        signals: Table<u64, Signal>,
        signal_count: u64,
        total_platform_volume: u64,
    }

    #[event]
    struct SignalPublished has drop, store {
        signal_id: u64,
        event_id: String,
        author: address,
        timestamp: u64,
        confidence: String,
    }

    #[event]
    struct TipSent has drop, store {
        signal_id: u64,
        from: address,
        to: address,
        amount: u64,
        timestamp: u64,
    }

    public entry fun initialize(account: &signer) {
        let addr = signer::address_of(account);
        assert!(!exists<MarketplaceRegistry>(addr), E_SIGNAL_ALREADY_EXISTS);
        
        move_to(account, MarketplaceRegistry {
            signals: table::new(),
            signal_count: 0,
            total_platform_volume: 0,
        });
    }

    public entry fun publish_signal(
        account: &signer,
        event_id: String,
        market_title: String,
        venue: String,
        event_time: u64,
        market_snapshot_hash: String,
        weather_hash: String,
        ai_digest: String,
        confidence: String,
        odds_efficiency: String,
    ) acquires MarketplaceRegistry {
        let author = signer::address_of(account);
        let now = timestamp::now_seconds();

        if (!exists<MarketplaceRegistry>(author)) {
            initialize(account);
        };

        let registry = borrow_global_mut<MarketplaceRegistry>(author);
        let signal_id = registry.signal_count;

        let signal = Signal {
            event_id,
            market_title,
            venue,
            event_time,
            market_snapshot_hash,
            weather_hash,
            ai_digest,
            confidence,
            odds_efficiency,
            author_address: author,
            timestamp: now,
            total_tips: 0,
        };

        table::add(&mut registry.signals, signal_id, signal);
        registry.signal_count = signal_id + 1;

        event::emit(SignalPublished {
            signal_id,
            event_id: signal.event_id,
            author,
            timestamp: now,
            confidence: signal.confidence,
        });
    }

    /// Tip an analyst for their signal
    /// Only works with the native gas coin (AptosCoin on Aptos, MoveCoin on Movement)
    public entry fun tip_analyst(
        tipper: &signer,
        author_addr: address,
        signal_id: u64,
        amount: u64
    ) acquires MarketplaceRegistry {
        let tipper_addr = signer::address_of(tipper);
        assert!(tipper_addr != author_addr, E_CANNOT_TIP_SELF);
        assert!(exists<MarketplaceRegistry>(author_addr), E_REGISTRY_NOT_INITIALIZED);

        let registry = borrow_global_mut<MarketplaceRegistry>(author_addr);
        assert!(table::contains(&registry.signals, signal_id), E_SIGNAL_NOT_FOUND);

        // Update stats
        let signal = table::borrow_mut(&mut registry.signals, signal_id);
        signal.total_tips = signal.total_tips + amount;
        registry.total_platform_volume = registry.total_platform_volume + amount;

        // Transfer funds
        coin::transfer<AptosCoin>(tipper, author_addr, amount);

        event::emit(TipSent {
            signal_id,
            from: tipper_addr,
            to: author_addr,
            amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    #[view]
    public fun get_signal_stats(account_addr: address, signal_id: u64): u64 acquires MarketplaceRegistry {
        let registry = borrow_global<MarketplaceRegistry>(account_addr);
        let signal = table::borrow(&registry.signals, signal_id);
        signal.total_tips
    }

    #[view]
    public fun get_signal(account_addr: address, signal_id: u64): (
        String, String, String, u64, String, String, String, String, String, address, u64, u64
    ) acquires MarketplaceRegistry {
        let registry = borrow_global<MarketplaceRegistry>(account_addr);
        let signal = table::borrow(&registry.signals, signal_id);
        (
            signal.event_id,
            signal.market_title,
            signal.venue,
            signal.event_time,
            signal.market_snapshot_hash,
            signal.weather_hash,
            signal.ai_digest,
            signal.confidence,
            signal.odds_efficiency,
            signal.author_address,
            signal.timestamp,
            signal.total_tips
        )
    }

    #[view]
    public fun get_platform_stats(account_addr: address): (u64, u64) acquires MarketplaceRegistry {
        if (!exists<MarketplaceRegistry>(account_addr)) {
            return (0, 0)
        };
        let registry = borrow_global<MarketplaceRegistry>(account_addr);
        (registry.signal_count, registry.total_platform_volume)
    }
}
