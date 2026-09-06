import type { AppointmentStatus, InventoryAction, Medication, MedicationReminderStatus, Notification, UserRole } from '@/types/database';
import { dashboardRangeLabels, type DashboardMetric, type DashboardRange, type DashboardView, type SendBroadcastInput } from '@/features/dashboard/types';
import { ClinicMockDatabase, mockResult } from './engine';

function subtractDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function toBangkokDate(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Bangkok',
  }).formatToParts(new Date(value));
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

export function createClinicRepositories(database: ClinicMockDatabase) {
  return {
    profiles: {
      list: () => database.select('profiles'),
      getById: (id: string) => database.findById('profiles', id),
      update: (id: string, changes: Parameters<typeof database.updateById<'profiles'>>[2]) => database.updateById('profiles', id, changes),
    },
    schedules: {
      listDepartments: () => database.select('departments'),
      listDoctors: () => database.select('doctors'),
      listSlots: () => database.select('appointment_slots'),
    },
    appointments: {
      list: () => database.select('appointments'),
      listWithDetails: async (patientId?: string) => {
        const tables = database.snapshot();
        const data = tables.appointments
          .filter((item) => !patientId || item.user_id === patientId)
          .map((appointment) => {
            const slot = tables.appointment_slots.find((item) => item.id === appointment.slot_id);
            const doctor = slot && tables.doctors.find((item) => item.id === slot.doctor_id);
            return {
              ...appointment,
              patient: tables.profiles.find((item) => item.id === appointment.user_id),
              slot: slot && {
                ...slot,
                doctor: doctor && {
                  ...doctor,
                  profile: tables.profiles.find((item) => item.id === doctor.id),
                  department: tables.departments.find((item) => item.id === doctor.department_id),
                },
              },
            };
          })
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return mockResult.ok(data);
      },
      updateStatus: (id: string, status: AppointmentStatus) => database.updateById('appointments', id, { status, updated_at: new Date().toISOString() }),
    },
    records: {
      list: () => database.select('medical_records'),
      listWithDetails: async (patientId?: string) => {
        const tables = database.snapshot();
        return mockResult.ok(tables.medical_records
          .filter((item) => !patientId || item.patient_id === patientId)
          .map((record) => ({
            ...record,
            patient: tables.profiles.find((item) => item.id === record.patient_id),
            appointment: tables.appointments.find((item) => item.id === record.appointment_id),
            doctor: {
              ...tables.doctors.find((item) => item.id === record.doctor_id)!,
              profile: tables.profiles.find((item) => item.id === record.doctor_id),
            },
          })));
      },
    },
    pharmacy: {
      listMedications: async () => {
        const result = await database.select('medications');
        return result.error ? result : mockResult.ok(result.data.filter((item) => item.is_active));
      },
      listInventoryLogs: () => database.select('inventory_logs'),
      saveMedication: async (input: Pick<Medication, 'name' | 'type' | 'category' | 'stock' | 'min_stock' | 'expiry_date'>, id?: string) => {
        if (!input.name.trim() || !input.category.trim() || input.stock < 0 || input.min_stock < 0) {
          return mockResult.fail<Medication>('ข้อมูลยาไม่ถูกต้อง', '23514');
        }
        if (id) return database.updateById('medications', id, { ...input, updated_at: new Date().toISOString() });
        const revision = database.getRevision();
        return database.transaction(revision, (draft) => {
          if (draft.medications.some((item) => item.name.toLowerCase() === input.name.toLowerCase())) {
            return mockResult.fail<Medication>('ชื่อยานี้มีอยู่แล้ว', '23505');
          }
          const medication: Medication = {
            ...input,
            id: crypto.randomUUID(),
            description: null,
            ingredients: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          draft.medications.push(medication);
          return mockResult.ok(medication);
        });
      },
      deleteMedication: async (id: string) => {
        const revision = database.getRevision();
        return database.transaction(revision, (draft) => {
          const medication = draft.medications.find((item) => item.id === id);
          if (!medication) return mockResult.fail<'deleted' | 'disabled'>('ไม่พบยา', 'PGRST116');
          const referenced = draft.inventory_logs.some((item) => item.medication_id === id)
            || draft.medication_reminders.some((item) => item.medication_id === id)
            || draft.medical_records.some((record) => record.prescribed_medications?.some((item) => item.medication_id === id));
          if (referenced) {
            medication.is_active = false;
            medication.updated_at = new Date().toISOString();
            return mockResult.ok<'deleted' | 'disabled'>('disabled');
          }
          draft.medications = draft.medications.filter((item) => item.id !== id);
          return mockResult.ok<'deleted' | 'disabled'>('deleted');
        });
      },
      adjustStock: async (medicationId: string, pharmacistId: string, action: InventoryAction, quantity: number, reason: string | null = null) => {
        const revision = database.getRevision();
        return database.transaction(revision, (draft) => {
          const medication = draft.medications.find((item) => item.id === medicationId);
          if (!medication) return mockResult.fail('ไม่พบยา', '23503');
          const delta = action === 'add' ? quantity : -quantity;
          if (!Number.isInteger(quantity) || quantity <= 0 || medication.stock + delta < 0) return mockResult.fail('จำนวนสต๊อกไม่ถูกต้อง', '23514');
          medication.stock += delta;
          medication.updated_at = new Date().toISOString();
          draft.inventory_logs.push({ id: crypto.randomUUID(), medication_id: medicationId, pharmacist_id: pharmacistId, action, quantity, reason, created_at: new Date().toISOString() });
          return mockResult.ok(medication);
        });
      },
    },
    reminders: {
      list: () => database.select('medication_reminders'),
      listWithMedication: async (userId?: string) => {
        const tables = database.snapshot();
        return mockResult.ok(tables.medication_reminders
          .filter((item) => !userId || item.user_id === userId)
          .map((reminder) => ({
            ...reminder,
            medication: tables.medications.find((item) => item.id === reminder.medication_id),
            logs: tables.medication_logs.filter((item) => item.reminder_id === reminder.id),
          })));
      },
      listLogs: () => database.select('medication_logs'),
      updateStatus: (id: string, status: MedicationReminderStatus) => database.updateById('medication_reminders', id, { status, updated_at: new Date().toISOString() }),
    },
    notifications: {
      list: () => database.select('notifications'),
      listInbox: async (userId: string) => {
        const tables = database.snapshot();
        return mockResult.ok(tables.notifications
          .filter((item) => item.user_id === userId && !item.deleted_at)
          .sort((a, b) => b.created_at.localeCompare(a.created_at)));
      },
      markRead: (id: string) => database.updateById('notifications', id, { is_read: true }),
      markReadForUser: async (id: string, userId: string) => {
        const revision = database.getRevision();
        return database.transaction<Notification>(revision, (draft) => {
          const notification = draft.notifications.find((item) => item.id === id);
          if (!notification || notification.user_id !== userId || notification.deleted_at) {
            return mockResult.fail('ไม่มีสิทธิ์แก้ไขข้อความนี้', '42501');
          }
          notification.is_read = true;
          notification.read_at = new Date().toISOString();
          return mockResult.ok(notification);
        });
      },
      deleteForUser: async (id: string, userId: string) => {
        const revision = database.getRevision();
        return database.transaction<Notification>(revision, (draft) => {
          const notification = draft.notifications.find((item) => item.id === id);
          if (!notification || notification.user_id !== userId || notification.deleted_at) {
            return mockResult.fail('ไม่มีสิทธิ์ลบข้อความนี้', '42501');
          }
          notification.deleted_at = new Date().toISOString();
          return mockResult.ok(notification);
        });
      },
      sendBroadcast: async (input: SendBroadcastInput) => {
        const revision = database.getRevision();
        return database.transaction(revision, (draft) => {
          if (input.actorRole !== 'admin') {
            return mockResult.fail<{ recipientCount: number; created: boolean }>('เฉพาะ Admin เท่านั้นที่ส่ง Broadcast ได้', '42501');
          }
          const title = input.title.trim();
          const message = input.message.trim();
          if (!title || !message) {
            return mockResult.fail<{ recipientCount: number; created: boolean }>('กรุณากรอกหัวข้อและข้อความ', '23514');
          }
          const existing = draft.broadcasts.find((item) => item.request_key === input.requestKey);
          if (existing) {
            const recipientCount = draft.notifications.filter((item) => item.broadcast_id === existing.id).length;
            return mockResult.ok({ recipientCount, created: false });
          }
          const roles = new Set(input.audience.roles);
          const recipientIds = new Set(draft.profiles
            .filter((profile) => input.audience.all || roles.has(profile.role))
            .map((profile) => profile.id));
          if (recipientIds.size === 0) {
            return mockResult.fail<{ recipientCount: number; created: boolean }>('กรุณาเลือกผู้รับอย่างน้อยหนึ่งคน', '23514');
          }
          const now = new Date().toISOString();
          const broadcastId = crypto.randomUUID();
          draft.broadcasts.push({
            id: broadcastId,
            sent_by: input.actorId,
            title,
            message,
            notification_type: input.notificationType,
            audience: { all: input.audience.all, roles: [...input.audience.roles] },
            request_key: input.requestKey,
            sent_at: now,
            created_at: now,
          });
          recipientIds.forEach((userId) => {
            draft.notifications.push({
              id: crypto.randomUUID(), user_id: userId, type: input.notificationType, title, message, is_read: false,
              event_key: `broadcast:${broadcastId}:${userId}`, broadcast_id: broadcastId,
              read_at: null, deleted_at: null, created_at: now,
            });
          });
          return mockResult.ok({ recipientCount: recipientIds.size, created: true });
        });
      },
    },
    dashboard: {
      getSummary: async () => {
        const tables = database.snapshot();
        const today = '2026-09-05';
        const todaySlotIds = new Set(tables.appointment_slots.filter((item) => item.slot_date === today).map((item) => item.id));
        const todayAppointments = tables.appointments.filter((item) => todaySlotIds.has(item.slot_id));
        return mockResult.ok({
          todayAppointments: todayAppointments.length,
          patients: tables.profiles.filter((item) => item.role === 'patient').length,
          unreadNotifications: tables.notifications.filter((item) => !item.is_read).length,
          lowStockMedications: tables.medications.filter((item) => item.is_active && item.stock <= item.min_stock).length,
          expiredMedications: tables.medications.filter((item) => item.expiry_date && item.expiry_date < today).length,
          appointmentStatuses: {
            pending: todayAppointments.filter((item) => item.status === 'pending').length,
            confirmed: todayAppointments.filter((item) => item.status === 'confirmed').length,
            in_progress: todayAppointments.filter((item) => item.status === 'in_progress').length,
            completed: todayAppointments.filter((item) => item.status === 'completed').length,
          },
        });
      },
      getView: async (role: UserRole, requestedUserId?: string, today = '2026-09-06', range: DashboardRange = 'today') => {
        if (role === 'patient') return mockResult.fail<DashboardView>('ผู้ป่วยไม่มีสิทธิ์เข้าถึง Dashboard', '42501');
        const tables = database.snapshot();
        const rangeDays: Record<DashboardRange, number> = { today: 1, '7d': 7, '30d': 30 };
        const startDate = subtractDays(today, rangeDays[range] - 1);
        const isInRange = (date: string | undefined) => Boolean(date && date >= startDate && date <= today);
        const rangeLabel = dashboardRangeLabels[range];
        const rangeSuffix = range === 'today' ? rangeLabel : ` ${rangeLabel}`;
        const matchedActor = requestedUserId
          ? tables.profiles.find((profile) => profile.id === requestedUserId && profile.role === role)
          : null;
        const actor = matchedActor
          ?? (requestedUserId ? { id: requestedUserId, full_name: 'บัญชีที่เข้าสู่ระบบ' } : tables.profiles.find((profile) => profile.role === role))
          ?? null;
        const activeStatuses: AppointmentStatus[] = ['pending', 'confirmed', 'in_progress', 'completed', 'no_show'];
        const slotsById = new Map(tables.appointment_slots.map((slot) => [slot.id, slot]));
        const activeAppointments = tables.appointments.filter((appointment) => activeStatuses.includes(appointment.status));
        const scopedAppointments = activeAppointments.filter((appointment) => {
          if (!actor) return false;
          if (role === 'doctor') return slotsById.get(appointment.slot_id)?.doctor_id === actor.id;
          return true;
        });
        const rangeAppointments = scopedAppointments.filter((appointment) => isInRange(slotsById.get(appointment.slot_id)?.slot_date));
        const queueRemaining = rangeAppointments.filter((appointment) => appointment.status === 'confirmed' || appointment.status === 'in_progress').length;
        const completedInRange = rangeAppointments.filter((appointment) => appointment.status === 'completed').length;
        const unreadNotifications = actor
          ? tables.notifications.filter((notification) => notification.user_id === actor.id && !notification.is_read && !notification.deleted_at && isInRange(toBangkokDate(notification.created_at))).length
          : 0;
        const activeMedications = tables.medications.filter((medication) => medication.is_active);
        const lowStock = activeMedications.filter((medication) => medication.stock <= medication.min_stock && (!medication.expiry_date || medication.expiry_date >= today));
        const expired = activeMedications.filter((medication) => medication.expiry_date && medication.expiry_date < today);
        const patientReminders = actor
          ? tables.medication_reminders.filter((reminder) => reminder.user_id === actor.id && reminder.status === 'active')
          : [];
        const patientMedicationIds = new Set(patientReminders.map((reminder) => reminder.medication_id));
        const patientRangeAppointments = rangeAppointments;
        const prescribedItems = tables.medical_records.flatMap((record) => record.prescribed_medications ?? []);
        const pendingDispensing = tables.medical_records.filter((record) => (record.prescribed_medications?.length ?? 0) > 0).length;
        const backorders = prescribedItems.filter((item) => {
          const medication = tables.medications.find((candidate) => candidate.id === item.medication_id);
          return !medication || medication.stock < item.quantity;
        }).length;
        const roleCounts = (['patient', 'staff', 'doctor', 'pharmacist', 'admin'] as UserRole[]).map((profileRole) => ({
          role: profileRole,
          count: tables.profiles.filter((profile) => profile.role === profileRole && profile.is_active !== false).length,
        }));
        const metric = (value: number | string, id: string, label: string, description: string, href: string, tone: DashboardMetric['tone']): DashboardMetric => ({
          id, label, value, description, href, tone,
        });
        const metricsByRole: Record<UserRole, DashboardMetric[]> = {
          staff: [
            metric(rangeAppointments.length, 'appointments-in-range', `นัดหมาย${rangeSuffix}`, 'ไม่รวมรายการยกเลิกและปฏิเสธ', '/appointments', 'blue'),
            metric(queueRemaining, 'remaining-queue', range === 'today' ? 'คิวที่เหลือ' : 'คิวในช่วงที่เลือก', 'ยืนยันแล้วและกำลังตรวจ', '/appointments', 'amber'),
            metric(tables.departments.length, 'department-workload', 'แผนกที่ให้บริการ', 'ดูภาระงานแยกตามแผนก', '/schedules', 'violet'),
            metric(unreadNotifications, 'unread-notifications', 'ยังไม่ได้อ่าน', 'ข้อความของบัญชีนี้', '/notifications', 'rose'),
          ],
          doctor: [
            metric(rangeAppointments.length, 'own-appointments', `นัดของฉัน${rangeSuffix}`, 'เฉพาะตารางแพทย์ที่เข้าสู่ระบบ', '/appointments', 'blue'),
            metric(queueRemaining, 'own-queue', range === 'today' ? 'คิวของฉันที่เหลือ' : 'คิวของฉันในช่วงที่เลือก', 'ยืนยันแล้วและกำลังตรวจ', '/appointments', 'amber'),
            metric(completedInRange, 'completed-in-range', `ตรวจเสร็จ${rangeSuffix}`, 'นับสถานะเสร็จสิ้น', '/appointments', 'emerald'),
            metric(unreadNotifications, 'unread-notifications', 'ยังไม่ได้อ่าน', 'ข้อความของบัญชีนี้', '/notifications', 'rose'),
          ],
          pharmacist: [
            metric(pendingDispensing, 'pending-dispensing', 'รอจ่ายยา', 'ใบสั่งยาที่มีรายการยา', '/pharmacy', 'blue'),
            metric(backorders, 'backorders', 'ยาค้างจ่าย', 'รายการที่สต๊อกยังไม่เพียงพอ', '/pharmacy', 'amber'),
            metric(lowStock.length, 'low-stock', 'ยาใกล้หมด', 'สต๊อกต่ำกว่าหรือเท่าจุดสั่งซื้อ', '/pharmacy', 'rose'),
            metric(expired.length, 'expired', 'ยาหมดอายุ', 'แยกออกจากรายการยาใกล้หมด', '/pharmacy', 'violet'),
          ],
          admin: [
            metric(tables.profiles.length, 'accounts', 'บัญชีทั้งหมด', 'สรุปรวมโดยไม่แสดงข้อมูลผู้ป่วย', '/profile', 'blue'),
            metric(roleCounts.filter((item) => item.count > 0).length, 'permissions', 'บทบาทที่ใช้งาน', 'สิทธิ์ที่มีผู้ใช้งานอยู่', '/profile', 'violet'),
            metric('ปกติ', 'system-status', 'สถานะระบบ', 'Mock repository พร้อมใช้งาน', '/dashboard', 'emerald'),
            metric(rangeAppointments.length, 'aggregate-appointments', `นัดหมาย${rangeSuffix}`, 'ข้อมูลรวมทุกแผนก', '/appointments', 'amber'),
          ],
          patient: [
            metric(patientRangeAppointments.length, 'my-appointments', `นัดหมายของฉัน${rangeSuffix}`, 'ไม่รวมรายการยกเลิกและปฏิเสธ', '/appointments', 'blue'),
            metric(patientMedicationIds.size, 'my-medications', 'ยาที่กำลังใช้', 'นับจากรายการเตือนยาที่ใช้งาน', '/reminders', 'violet'),
            metric(patientReminders.length, 'my-reminders', 'การเตือนที่ใช้งาน', 'เวลาทานยาที่ผู้ป่วยยืนยันแล้ว', '/reminders', 'emerald'),
            metric(unreadNotifications, 'unread-notifications', 'ยังไม่ได้อ่าน', 'ข้อความของบัญชีนี้', '/notifications', 'rose'),
          ],
        };
        const statusDefinitions: Array<{ status: AppointmentStatus; label: string }> = [
          { status: 'pending', label: 'รอยืนยัน' },
          { status: 'confirmed', label: 'ยืนยันแล้ว' },
          { status: 'in_progress', label: 'กำลังตรวจ' },
          { status: 'completed', label: 'เสร็จสิ้น' },
        ];
        const departmentLoads = tables.departments.map((department) => {
          const doctorIds = new Set(tables.doctors.filter((doctor) => doctor.department_id === department.id).map((doctor) => doctor.id));
          const slots = tables.appointment_slots.filter((slot) => isInRange(slot.slot_date) && doctorIds.has(slot.doctor_id));
          const slotIds = new Set(slots.map((slot) => slot.id));
          return {
            departmentId: department.id,
            departmentName: department.name,
            appointmentCount: activeAppointments.filter((appointment) => slotIds.has(appointment.slot_id)).length,
            capacity: slots.reduce((sum, slot) => sum + slot.max_capacity, 0),
          };
        });
        const appointmentQueue = rangeAppointments
          .map((appointment) => {
            const slot = slotsById.get(appointment.slot_id);
            const doctor = slot ? tables.profiles.find((profile) => profile.id === slot.doctor_id) : null;
            const doctorRecord = slot ? tables.doctors.find((item) => item.id === slot.doctor_id) : null;
            const department = doctorRecord ? tables.departments.find((item) => item.id === doctorRecord.department_id) : null;
            const patient = tables.profiles.find((profile) => profile.id === appointment.user_id);
            return {
              id: appointment.id,
              queueNumber: appointment.queue_number,
              date: slot?.slot_date ?? '',
              startTime: slot?.start_time ?? '',
              status: appointment.status,
              patientName: patient?.full_name ?? 'ไม่พบบัญชีผู้ป่วย',
              doctorName: doctor?.full_name ?? 'ไม่พบแพทย์',
              departmentName: department?.name ?? 'ไม่ระบุแผนก',
            };
          })
          .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`))
          .slice(0, 8);
        const copyByRole: Record<UserRole, { title: string; description: string }> = {
          staff: { title: 'ภาพรวมงานคลินิก', description: 'ติดตามนัดหมาย คิว และภาระงานของแต่ละแผนก' },
          doctor: { title: 'ภาพรวมงานแพทย์', description: 'แสดงเฉพาะตารางและคิวของแพทย์ที่เข้าสู่ระบบ' },
          pharmacist: { title: 'ภาพรวมงานเภสัชกรรม', description: 'ติดตามงานจ่ายยา ยาค้างจ่าย และสถานะคลังยา' },
          admin: { title: 'ภาพรวมผู้ดูแลระบบ', description: 'บัญชี สิทธิ์ สถานะระบบ และสถิติรวมที่ไม่เปิดเผยข้อมูลผู้ป่วย' },
          patient: { title: 'ภาพรวมสุขภาพของฉัน', description: 'นัดหมาย ยา การเตือน และข้อความของบัญชีนี้เท่านั้น' },
        };
        const view: DashboardView = {
          role,
          actor: actor ? { id: actor.id, fullName: actor.full_name } : null,
          date: today,
          startDate,
          range,
          ...copyByRole[role],
          metrics: metricsByRole[role],
          appointmentStatuses: statusDefinitions.map(({ status, label }) => ({
            status,
            label,
            count: rangeAppointments.filter((appointment) => appointment.status === status).length,
          })),
          appointmentQueue,
          departmentLoads,
          medicationAlerts: activeMedications
            .filter((medication) => medication.stock <= medication.min_stock || Boolean(medication.expiry_date && medication.expiry_date < today))
            .map((medication) => ({
              id: medication.id,
              name: medication.name,
              stock: medication.stock,
              minimumStock: medication.min_stock,
              expiryDate: medication.expiry_date,
              lowStock: medication.stock <= medication.min_stock && (!medication.expiry_date || medication.expiry_date >= today),
              expired: Boolean(medication.expiry_date && medication.expiry_date < today),
            })),
          recentNotifications: actor
            ? tables.notifications
              .filter((notification) => notification.user_id === actor.id && !notification.deleted_at && isInRange(toBangkokDate(notification.created_at)))
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 5)
            : [],
          roleCounts,
        };
        return mockResult.ok(view);
      },
    },
  };
}

export type ClinicRepositories = ReturnType<typeof createClinicRepositories>;
