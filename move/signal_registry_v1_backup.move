module fourcast_addr::signal_registry {
    use std::string::String;
    use std::signer;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};

    /// Signal object representing a weather × odds × AI analysis
    struct Signal has store, drop, copy {
        event_id: String,
        market_title: String,
        venue: String,
        event_time: u64,
        market_snapshot_hash: String,
        weather_json: String,
        ai_digest: String,
        confidence: String,
        odds_efficiency: String,
        author_address: address,
        timestamp: u64,
    }

    /// Registry to store all signals
    struct SignalRegistry has key {
        signals: Table<String, Signal>,
        signal_count: u64,
    }

    /// Event emitted when a signal is published (for indexing)
    #[event]
    struct SignalPublished has drop, store {
        signal_id: String,
        event_id: String,
        author: address,
        timestamp: u64,
        confidence: String,
        odds_efficiency: String,
    }

    /// Initialize the registry (call once per account)
    public entry fun initialize(account: &signer) {
        let registry = SignalRegistry {
            signals: table::new(),
            signal_count: 0,
        };
        move_to(account, registry);
    }

    /// Publish a new signal (user wallet signs this transaction)
    public entry fun publish_signal(
        account: &signer,
        event_id: String,
        market_title: String,
        venue: String,
        event_time: u64,
        market_snapshot_hash: String,
        weather_json: String,
        ai_digest: String,
        confidence: String,
        odds_efficiency: String,
    ) acquires SignalRegistry {
        let author = signer::address_of(account);
        let now = timestamp::now_seconds();

        // Create signal
        let signal = Signal {
            event_id,
            market_title,
            venue,
            event_time,
            market_snapshot_hash,
            weather_json,
            ai_digest,
            confidence,
            odds_efficiency,
            author_address: author,
            timestamp: now,
        };

        // Initialize registry if it doesn't exist
        if (!exists<SignalRegistry>(author)) {
            initialize(account);
        };

        // Store signal in registry
        let registry = borrow_global_mut<SignalRegistry>(author);
        let signal_id = market_snapshot_hash;
        table::add(&mut registry.signals, signal_id, signal);
        registry.signal_count = registry.signal_count + 1;

        // Emit event for indexing
        event::emit(SignalPublished {
            signal_id,
            event_id,
            author,
            timestamp: now,
            confidence,
            odds_efficiency,
        });
    }

    /// Get signal count for an account (view function)
    #[view]
    public fun get_signal_count(account_addr: address): u64 acquires SignalRegistry {
        if (!exists<SignalRegistry>(account_addr)) {
            return 0
        };
        let registry = borrow_global<SignalRegistry>(account_addr);
        registry.signal_count
    }
}
