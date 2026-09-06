CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT, 
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- Drop triggers if they exist so we can run this multiple times safely
DROP TRIGGER IF EXISTS on_new_profile_created ON public.profiles;
DROP TRIGGER IF EXISTS on_new_appointment ON public.appointments;
DROP TRIGGER IF EXISTS on_new_complaint ON public.complaints;
DROP TRIGGER IF EXISTS on_complaint_reply ON public.complaints;
DROP TRIGGER IF EXISTS on_new_consultation ON public.consultations;
DROP TRIGGER IF EXISTS on_consultation_reply ON public.consultations;
DROP TRIGGER IF EXISTS on_new_medical_news ON public.medical_news;

-- 1. Notify Manager on New User
CREATE OR REPLACE FUNCTION public.notify_manager_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'patient' THEN
    INSERT INTO notifications (user_id, title, message, type)
    SELECT id, 'مستخدم جديد', 'تم تسجيل مستخدم جديد باسم: ' || COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''), 'system'
    FROM profiles WHERE role = 'manager';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.notify_manager_new_user();

-- 2. Notify Manager and Doctor on New Appointment
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS TRIGGER AS $$
DECLARE
  patient_name TEXT;
  clinic_name TEXT;
BEGIN
  SELECT first_name || ' ' || last_name INTO patient_name FROM profiles WHERE id = NEW.patient_id;
  SELECT name INTO clinic_name FROM clinics WHERE id = NEW.clinic_id;

  INSERT INTO notifications (user_id, title, message, type)
  SELECT id, 'حجز جديد', 'تم حجز موعد جديد للمريض ' || COALESCE(patient_name, 'غير محدد') || ' في عيادة ' || COALESCE(clinic_name, ''), 'appointment'
  FROM profiles WHERE role = 'manager';

  IF NEW.doctor_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (NEW.doctor_id, 'حجز جديد', 'تم حجز موعد جديد لك مع المريض ' || COALESCE(patient_name, 'غير محدد'), 'appointment');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE PROCEDURE public.notify_new_appointment();

-- 3. Notify Manager on New Complaint
CREATE OR REPLACE FUNCTION public.notify_new_complaint()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  type_ar TEXT;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT first_name || ' ' || last_name INTO sender_name FROM profiles WHERE id = NEW.user_id;
  ELSE
    sender_name := 'زائر';
  END IF;
  
  IF NEW.type = 'complaint' THEN type_ar := 'شكوى'; ELSE type_ar := 'اقتراح'; END IF;

  INSERT INTO notifications (user_id, title, message, type)
  SELECT id, type_ar || ' جديدة', 'يوجد ' || type_ar || ' جديدة من ' || COALESCE(sender_name, 'زائر'), 'complaint'
  FROM profiles WHERE role = 'manager';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_complaint
  AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE PROCEDURE public.notify_new_complaint();

-- 4. Notify Patient on Complaint Reply
CREATE OR REPLACE FUNCTION public.notify_complaint_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'resolved' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (NEW.user_id, 'تم الرد على الشكوى/الاقتراح', 'قامت الإدارة بالرد على شكواك/اقتراحك', 'complaint');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_complaint_reply
  AFTER UPDATE ON public.complaints
  FOR EACH ROW EXECUTE PROCEDURE public.notify_complaint_reply();

-- 5. Notify Manager and Doctor on New Consultation
CREATE OR REPLACE FUNCTION public.notify_new_consultation()
RETURNS TRIGGER AS $$
DECLARE
  patient_name TEXT;
BEGIN
  SELECT first_name || ' ' || last_name INTO patient_name FROM profiles WHERE id = NEW.patient_id;
  
  INSERT INTO notifications (user_id, title, message, type)
  SELECT id, 'استشارة جديدة', 'طلب استشارة جديدة من المريض ' || COALESCE(patient_name, ''), 'consultation'
  FROM profiles WHERE role = 'manager';

  IF NEW.doctor_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (NEW.doctor_id, 'استشارة جديدة', 'لديك استشارة جديدة من المريض ' || COALESCE(patient_name, ''), 'consultation');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_consultation
  AFTER INSERT ON public.consultations
  FOR EACH ROW EXECUTE PROCEDURE public.notify_new_consultation();

-- 6. Notify Patient on Consultation Reply
CREATE OR REPLACE FUNCTION public.notify_consultation_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.reply IS NULL AND NEW.reply IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (NEW.patient_id, 'تم الرد على الاستشارة', 'قام الطبيب بالرد على استشارتك الطبية', 'consultation');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_consultation_reply
  AFTER UPDATE ON public.consultations
  FOR EACH ROW EXECUTE PROCEDURE public.notify_consultation_reply();

-- 7. Notify Patients on New Medical News
CREATE OR REPLACE FUNCTION public.notify_new_medical_news()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type)
  SELECT id, 'خبر طبي جديد', NEW.title, 'news'
  FROM profiles WHERE role = 'patient';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_medical_news
  AFTER INSERT ON public.medical_news
  FOR EACH ROW EXECUTE PROCEDURE public.notify_new_medical_news();

