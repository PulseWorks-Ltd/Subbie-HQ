// Shared sentinel value for the "Assign QA" option in every Update tag
// <select> (compose-time in UpdateComposer, and post-hoc in UpdateThread /
// MobileThread) — never sent to the server as-is. Each caller intercepts it
// before any PATCH/POST and opens AssignUpdateAsQaDialog instead, since
// creating a QARecord needs a stage label first.
export const ASSIGN_QA_SENTINEL = "__qa__";
