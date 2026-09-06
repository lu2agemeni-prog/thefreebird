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

-- Doctor Appointments RLS
DROP POLICY IF EXISTS "Doctors can view their own appointments" ON appointments;
DROP POLICY IF EXISTS "Doctors can update their own appointments" ON appointments;
CREATE POLICY "Doctors can view their own appointments" ON appointments FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "Doctors can update their own appointments" ON appointments FOR UPDATE USING (auth.uid() = doctor_id);

-- Doctor Consultations RLS
DROP POLICY IF EXISTS "Doctors can view their own consultations" ON consultations;
DROP POLICY IF EXISTS "Doctors can update their own consultations" ON consultations;
CREATE POLICY "Doctors can view their own consultations" ON consultations FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "Doctors can update their own consultations" ON consultations FOR UPDATE USING (auth.uid() = doctor_id);


-- Doctor Transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);

-- Call Queue RLS
DROP POLICY IF EXISTS "Doctors can manage call queue" ON call_queue;
CREATE POLICY "Doctors can manage call queue" ON call_queue FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'doctor'::user_role);


-- Appointments RLS for Secretary
CREATE POLICY "Secretaries can manage all appointments" ON appointments FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('secretary'::user_role, 'manager'::user_role)
);

-- Profiles RLS for Secretary
CREATE POLICY "Secretaries can view all profiles" ON profiles FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('secretary'::user_role, 'manager'::user_role)
);

-- Call Queue RLS for Secretary
CREATE POLICY "Secretaries can manage call queue" ON call_queue FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('secretary'::user_role, 'manager'::user_role)
);

-- Transactions RLS for Accountant
CREATE POLICY "Accountants can manage transactions" ON transactions FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('accountant'::user_role, 'manager'::user_role)
);
