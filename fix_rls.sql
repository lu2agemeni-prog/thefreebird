-- Profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Patient Records
ALTER TABLE patient_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own records" ON patient_records;
DROP POLICY IF EXISTS "Managers and Doctors can view all records" ON patient_records;
CREATE POLICY "Users can manage their own records" ON patient_records FOR ALL USING (auth.uid() = profile_id);
CREATE POLICY "Managers and Doctors can view all records" ON patient_records FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager'::user_role, 'doctor'::user_role)
);

-- Appointments
DROP POLICY IF EXISTS "Patients can view their appointments" ON appointments;
DROP POLICY IF EXISTS "Patients can insert their appointments" ON appointments;
CREATE POLICY "Patients can view their appointments" ON appointments FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patients can insert their appointments" ON appointments FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Consultations
DROP POLICY IF EXISTS "Patients can view their consultations" ON consultations;
DROP POLICY IF EXISTS "Patients can insert their consultations" ON consultations;
CREATE POLICY "Patients can view their consultations" ON consultations FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patients can insert their consultations" ON consultations FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Complaints
DROP POLICY IF EXISTS "Users can view their own complaints" ON complaints;
CREATE POLICY "Users can view their own complaints" ON complaints FOR SELECT USING (auth.uid() = user_id);
