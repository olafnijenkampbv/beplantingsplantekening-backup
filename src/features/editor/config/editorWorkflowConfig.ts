export type EditorWorkflowStepState = "done" | "active" | "upcoming";

export type EditorWorkflowStep = {
    id: number;
    title: string;
    state: EditorWorkflowStepState;
};

export const PLANT_SELECTION_WORKFLOW_STEPS: EditorWorkflowStep[] = [
    { id: 1, title: "Locatie\nbepalen", state: "done" },
    { id: 2, title: "Situatie &\nrandvoorwaarden", state: "done" },
    { id: 3, title: "Structuur &\nopbouw", state: "done" },
    { id: 4, title: "Beleving &\nruimte", state: "done" },
    { id: 5, title: "Plantenvoorstel &\naanpassen", state: "active" },
    { id: 6, title: "Planten koppelen\nin tekening", state: "upcoming" },
    { id: 7, title: "Beplantingsplan\nafronden", state: "upcoming" },
];