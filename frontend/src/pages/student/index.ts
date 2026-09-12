export { AttendanceCopilotSheet } from "./AttendanceCopilotSheet";
export type { AttendanceCopilotHandler, AttendanceCopilotSheetProps } from "./AttendanceCopilotSheet";

export { StudentAttendancePage, demoStudentAttendanceData } from "./StudentAttendancePage";
export type {
  AttendanceLeader,
  AttendanceSubjectGroup,
  StudentAttendanceData,
  StudentAttendancePageProps,
  StudentAttendanceSubject,
} from "./StudentAttendancePage";

export { StudentEligibilityPage, demoEligibilityData } from "./StudentEligibilityPage";
export type {
  AbsenceDocumentPayload,
  StudentEligibilityData,
  StudentEligibilityPageProps,
} from "./StudentEligibilityPage";

export { StudentDiaryPage } from "./StudentDiaryPage";
export type {
  StudentDiaryData,
  StudentDiaryFilter,
  StudentDiaryItem,
  StudentDiaryPageProps,
} from "./StudentDiaryPage";

export { StudentLeaveNewPage } from "./StudentLeaveNewPage";
export type { LeaveCategory, StudentLeaveDraft, StudentLeaveNewPageProps } from "./StudentLeaveNewPage";

export { StudentLeaveStatusPage, demoLeaveStatusData } from "./StudentLeaveStatusPage";
export type {
  LeaveHistoryRecord,
  LeaveStatusStep,
  StudentLeaveStatusData,
  StudentLeaveStatusPageProps,
} from "./StudentLeaveStatusPage";

export { StudentTimetablePage } from "./StudentTimetablePage";
export type { StudentTimetablePageProps } from "./StudentTimetablePage";

export { StudentWeekGridPage } from "./StudentWeekGridPage";
export type { StudentWeekGridPageProps } from "./StudentWeekGridPage";

export { StudentShell, defaultStudentRoutes } from "./StudentShell";
export type { StudentNavKey, StudentRouteMap, StudentShellProps } from "./StudentShell";

export { demoTimetableDays, weekGridRows } from "./student-timetable-data";
export type {
  SchoolDayKey,
  TimetableDay,
  TimetablePeriod,
  TimetableTone,
  WeekGridRow,
} from "./student-timetable-data";
