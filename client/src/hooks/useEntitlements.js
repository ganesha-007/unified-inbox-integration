import { useState, useEffect } from 'react';
import axios from 'axios';

export const useEntitlements = () => {
  const [entitlements, setEntitlements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEntitlements = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/auth/entitlements');
      setEntitlements(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch entitlements');
      console.error('Error fetching entitlements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntitlements();
  }, []);

  return {
    entitlements,
    loading,
    error,
    refetch: fetchEntitlements,
  };
};
