import { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator,
    FlatList
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Registrations() {
    const { tournament_id } = useLocalSearchParams();
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tournamentTitle, setTournamentTitle] = useState('');

    useEffect(() => {
        fetchRegistrations();
    }, []);

    async function fetchRegistrations() {
        const { data: tournament } = await supabase
            .from('tournaments')
            .select('title')
            .eq('id', tournament_id)
            .single();

        if (tournament) setTournamentTitle(tournament.title);

        const { data, error } = await supabase
            .from('registrations')
            .select('*, teams(name)')
            .eq('tournament_id', tournament_id)
            .order('created_at', { ascending: false });

        console.log('Registration data:', JSON.stringify(data));
        console.log('Registration error:', JSON.stringify(error));
        if (data) setRegistrations(data);
        setLoading(false);
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#7C3AED" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>{tournamentTitle}</Text>
            <Text style={styles.sub}>
                {registrations.length} team{registrations.length !== 1 ? 's' : ''} registered
            </Text>

            {registrations.length === 0 ? (
                <Text style={styles.emptyText}>No teams registered yet.</Text>
            ) : (
                <FlatList
                    data={registrations}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <View style={styles.cardLeft}>
                                <Text style={styles.teamName}>
                                    {item.teams?.name ?? 'Unknown Team'}
                                </Text>
                                <Text style={styles.teamSub}>Registered team</Text>
                            </View>
                            <View style={[
                                styles.badge,
                                item.status === 'confirmed' ? styles.badgeConfirmed : styles.badgePending
                            ]}>
                                <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingTop: 60 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
    heading: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
    sub: { fontSize: 14, color: '#aaa', marginBottom: 24 },
    emptyText: { color: '#555', fontSize: 14, textAlign: 'center', marginTop: 40 },
    card: {
        backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
        marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a',
    },
    cardLeft: { flex: 1, marginRight: 12 },
    teamName: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
    teamSub: { fontSize: 12, color: '#666' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgePending: { backgroundColor: '#3a2a00' },
    badgeConfirmed: { backgroundColor: '#0a3a0a' },
    badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});