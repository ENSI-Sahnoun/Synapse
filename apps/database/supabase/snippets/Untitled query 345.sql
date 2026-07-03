UPDATE reservations SET status = 'expired' WHERE status = 'active';
UPDATE seats SET status = 'free' WHERE status = 'reserved';