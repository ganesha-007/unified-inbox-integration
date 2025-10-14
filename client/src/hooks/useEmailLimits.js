import { useState, useEffect } from 'react';
import axios from 'axios';

export const useEmailLimits = (accountId) => {
  const [limits, setLimits] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLimits = async () => {
    if (!accountId) {
      setLimits(null);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`/api/channels/email/${accountId}/limits`);
      setLimits(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch email limits');
      console.error('Error fetching email limits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLimits();
    
    // Refresh limits every minute
    const interval = setInterval(fetchLimits, 60000);
    
    return () => clearInterval(interval);
  }, [accountId]);

  return {
    limits,
    loading,
    error,
    refetch: fetchLimits,
  };
};
