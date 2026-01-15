-- Enable realtime for runs and prompt_runs tables
ALTER PUBLICATION supabase_realtime ADD TABLE runs;
ALTER PUBLICATION supabase_realtime ADD TABLE prompt_runs;
