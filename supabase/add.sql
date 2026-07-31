CREATE POLICY "superadmin_read_all_events"
ON events FOR SELECT
TO authenticated
USING (auth.uid() = '83104e18-b209-412a-adeb-19af2457833f');
 
CREATE POLICY "superadmin_write_all_events"
ON events FOR ALL
TO authenticated
USING (auth.uid() = '83104e18-b209-412a-adeb-19af2457833f')
WITH CHECK (auth.uid() = '83104e18-b209-412a-adeb-19af2457833f');


-- Table messages (contact organisateur)
CREATE TABLE messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  sender_name text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
 
-- Table reviews (avis app)
CREATE TABLE reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text REFERENCES events(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);
 
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
 
-- Tout le monde peut insérer (participants anonymes)
CREATE POLICY "anyone_insert_messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone_insert_reviews"  ON reviews  FOR INSERT WITH CHECK (true);
 
-- Seul le superadmin peut lire
CREATE POLICY "superadmin_read_messages" ON messages FOR SELECT TO authenticated
USING (auth.uid() = '83104e18-b209-412a-adeb-19af2457833f');
 
CREATE POLICY "superadmin_read_reviews" ON reviews FOR SELECT TO authenticated
USING (auth.uid() = '83104e18-b209-412a-adeb-19af2457833f');
 
-- Fonction pour lister les utilisateurs (superadmin seulement)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE(id uuid, email text, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT id, email, created_at FROM auth.users
  WHERE NOT is_anonymous
  ORDER BY created_at DESC;
$$;
 
GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;


CREATE TABLE support_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- L'admin envoie ses propres messages
CREATE POLICY "organizer_insert_support" ON support_messages
FOR INSERT TO authenticated
WITH CHECK (organizer_id = auth.uid() AND sender_id = auth.uid());

-- Le superadmin peut répondre
CREATE POLICY "superadmin_insert_support" ON support_messages
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = '83104e18-b209-412a-adeb-19af2457833f');

-- L'admin lit sa propre conversation
CREATE POLICY "organizer_read_support" ON support_messages
FOR SELECT TO authenticated
USING (organizer_id = auth.uid());

-- Le superadmin lit tout
CREATE POLICY "superadmin_read_support" ON support_messages
FOR SELECT TO authenticated
USING (auth.uid() = '83104e18-b209-412a-adeb-19af2457833f');

-- Remplacer les anciennes policies par des nouvelles qui couvrent les deux UUIDs

-- events (si tu avais ces policies)
DROP POLICY IF EXISTS "superadmin_read_all_events" ON events;
DROP POLICY IF EXISTS "superadmin_write_all_events" ON events;
CREATE POLICY "superadmin_read_all_events" ON events FOR SELECT TO authenticated
USING (auth.uid() IN ('83104e18-b209-412a-adeb-19af2457833f','e6953387-7b43-43e0-ab18-22b7cc07de2c'));
CREATE POLICY "superadmin_write_all_events" ON events FOR ALL TO authenticated
USING (auth.uid() IN ('83104e18-b209-412a-adeb-19af2457833f','e6953387-7b43-43e0-ab18-22b7cc07de2c'))
WITH CHECK (auth.uid() IN ('83104e18-b209-412a-adeb-19af2457833f','e6953387-7b43-43e0-ab18-22b7cc07de2c'));

-- messages
DROP POLICY IF EXISTS "superadmin_read_messages" ON messages;
CREATE POLICY "superadmin_read_messages" ON messages FOR SELECT TO authenticated
USING (auth.uid() IN ('83104e18-b209-412a-adeb-19af2457833f','e6953387-7b43-43e0-ab18-22b7cc07de2c'));

-- reviews
DROP POLICY IF EXISTS "superadmin_read_reviews" ON reviews;
CREATE POLICY "superadmin_read_reviews" ON reviews FOR SELECT TO authenticated
USING (auth.uid() IN ('83104e18-b209-412a-adeb-19af2457833f','e6953387-7b43-43e0-ab18-22b7cc07de2c'));

-- support_messages
DROP POLICY IF EXISTS "superadmin_insert_support" ON support_messages;
DROP POLICY IF EXISTS "superadmin_read_support" ON support_messages;
CREATE POLICY "superadmin_insert_support" ON support_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() IN ('83104e18-b209-412a-adeb-19af2457833f','e6953387-7b43-43e0-ab18-22b7cc07de2c'));
CREATE POLICY "superadmin_read_support" ON support_messages FOR SELECT TO authenticated
USING (auth.uid() IN ('83104e18-b209-412a-adeb-19af2457833f','e6953387-7b43-43e0-ab18-22b7cc07de2c'));
