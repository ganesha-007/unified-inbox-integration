import { useState, useEffect } from 'react';
import axios from 'axios';

export const useConnections = () => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const providers = ['whatsapp', 'instagram', 'email'];
      const allConnections = [];

      for (const provider of providers) {
        try {
          const response = await axios.get(`/api/channels/${provider}/accounts`);
          const providerConnections = response.data.accounts.map(account => ({
            ...account,
            provider,
          }));
          allConnections.push(...providerConnections);
        } catch (err) {
          // Provider might not be accessible, skip it
          console.warn(`Failed to fetch ${provider} connections:`, err);
        }
      }

      setConnections(allConnections);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch connections');
      console.error('Error fetching connections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  return {
    connections,
    loading,
    error,
    refetch: fetchConnections,
  };
};
