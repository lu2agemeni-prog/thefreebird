-- SQL Script for "الطائر الحر" Clinic Management System
-- This script creates the necessary tables, roles, and functions for the Supabase database.
-- Note: Replace UUIDs and dummy data as needed after creation.

-- 1. Custom Types
CREATE TYPE user_role AS ENUM ('manager', 'doctor', 'patient', 'secretary', 'accountant');

-- 2. Profiles Table (Extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role user_role DEFAULT 'patient'::user_role,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Clinics Table
CREATE TABLE clinics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Doctors Table
CREATE TABLE doctors (
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    specialty TEXT,
    working_days JSONB, -- e.g., ["Monday", "Wednesday"]
    consultation_fee DECIMAL(10,2),
    bio TEXT
);

-- 5. Staff Table (Secretary, Accountant, Nurses)
CREATE TABLE staff (
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
    job_title TEXT,
    salary DECIMAL(10,2),
    hire_date DATE
);

-- 6. Patient Medical Records Table
CREATE TABLE patient_records (
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
    blood_group TEXT,
    allergies TEXT,
    chronic_diseases TEXT,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    notes TEXT
);

-- 7. Services & Prices Table
CREATE TABLE services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- 8. Appointments Table
CREATE TABLE appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(profile_id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, confirmed, completed, cancelled
    queue_number INT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 9. Consultations Table
CREATE TABLE consultations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(profile_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    reply TEXT,
    status TEXT DEFAULT 'pending', -- pending, answered
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 10. Financial Transactions Table (Income, Expenses, Salaries)
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, -- 'income', 'expense'
    category TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Who initiated/received
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 11. Complaints & Suggestions Table
CREATE TABLE complaints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'complaint', 'suggestion'
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open, resolved
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 12. Settings Table (General Clinic Settings)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB
);

-- 13. Patient Call Queue Table (For the 32-inch screen)
CREATE TABLE call_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    token_number INT NOT NULL,
    status TEXT DEFAULT 'waiting', -- waiting, calling, completed
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Functions & Triggers
-- Automatically create a profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  first_name_val TEXT;
  last_name_val TEXT;
BEGIN
  -- Try to extract names from Google OAuth metadata, fallback to generic names if missing
  first_name_val := COALESCE(
    new.raw_user_meta_data->>'first_name',
    split_part(new.raw_user_meta_data->>'full_name', ' ', 1),
    'مستخدم'
  );
  
  last_name_val := COALESCE(
    new.raw_user_meta_data->>'last_name',
    substring(new.raw_user_meta_data->>'full_name' from position(' ' in new.raw_user_meta_data->>'full_name') + 1),
    'جديد'
  );

  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name, 
    role, 
    avatar_url
  )
  VALUES (
    new.id,
    first_name_val,
    last_name_val,
    'patient'::user_role,
    new.raw_user_meta_data->>'avatar_url'
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Row Level Security (RLS) 
-- (Add your RLS policies here based on requirements, currently tables are accessible for quick start)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Managers can update roles" ON profiles FOR UPDATE USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'::user_role);

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public clinics are viewable by everyone." ON clinics FOR SELECT USING (true);
CREATE POLICY "Managers can insert clinics." ON clinics FOR INSERT WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'::user_role);

ALTER TABLE call_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Call queue is viewable by everyone." ON call_queue FOR SELECT USING (true);
CREATE POLICY "Staff can manage call queue" ON call_queue FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager'::user_role, 'secretary'::user_role, 'doctor'::user_role));

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Transactions viewable by managers and accountants" ON transactions FOR SELECT USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager'::user_role, 'accountant'::user_role));
CREATE POLICY "Managers and accountants can insert transactions" ON transactions FOR INSERT WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager'::user_role, 'accountant'::user_role));

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can manage appointments" ON appointments FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'::user_role);

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can manage consultations" ON consultations FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'::user_role);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers can manage complaints" ON complaints FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'::user_role);
CREATE POLICY "Anyone can insert complaints" ON complaints FOR INSERT WITH CHECK (true);

-- 14. Medical News Table
CREATE TABLE medical_news (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 15. News Likes Table
CREATE TABLE news_likes (
    news_id UUID REFERENCES medical_news(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (news_id, user_id)
);

-- RLS for medical_news
ALTER TABLE medical_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medical news is viewable by everyone" ON medical_news FOR SELECT USING (true);
CREATE POLICY "Managers can manage news" ON medical_news FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'::user_role);

-- RLS for news_likes
ALTER TABLE news_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes are viewable by everyone" ON news_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON news_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON news_likes FOR DELETE USING (auth.uid() = user_id);


