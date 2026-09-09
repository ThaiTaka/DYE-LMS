-- Cached completion percentage for a student's lesson.
--
-- Derived from BlockProgress by syncLessonCompletion, which is the only writer.
-- Stored so a class roster reads in one query instead of recomputing per pupil.
--
-- Existing rows keep 0 until the next sync; a COMPLETED lesson is corrected on
-- the student's next action, and the state column remains the source of truth
-- for whether a lesson is done.
ALTER TABLE "LessonProgress" ADD COLUMN "percent" INTEGER NOT NULL DEFAULT 0;
