import { useCallback } from 'react';

export const useApiQuota = () => {
    const setLimit = useCallback((newLimit: number) => {}, []);
    const decrementQuota = useCallback((amount: number) => {}, []);
    const forceQuotaDepletion = useCallback(() => {}, []);

    return { 
        remaining: Infinity, 
        limit: Infinity, 
        timeUntilReset: '', 
        setLimit, 
        decrementQuota, 
        forceQuotaDepletion 
    };
};