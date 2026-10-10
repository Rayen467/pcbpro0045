declare global {
  interface Window {
    PCBProProject?: any;
    PCBProWireEngine?: any;
    PCBProBoardModel?: any;
    PCBProAdvancedBoard?: any;
    PCBProWorkflow?: any;
    PCBProProfessional?: any;
    PCBProCommand?: any;
    PCBProCommandBus?: any;
    PCBProKiCadBehavior?: any;
    PCBProLiveSimulation?: any;
    PCBProDatabase?: any;
    PCBProExplain?: any;
    PCBProAssistantBrain?: any;
    PCBProAssistantV115?: any;
    PCBProComponentCatalog?: any;
    PCBProStability?: any;
    PCBProWorkspaceRepair?: any;
    PCBProManufacturing?: any;
    PCBProGeometry3D?: any;
    PCBProFootprintGeometry?: any;
    PCBProStepBodies?: any;
    PCBProPhysicalDRC?: any;
    PCBProIntegrity?: any;
    PCBProPcbDock?: any;
    PCBProProfessionalLearning?: any;
    PCBProAutoRouter?: any;
    PCBProHelp?: any;
    PCBProTheme?: {
      version: string;
      getMode(): 'light' | 'dark' | 'system';
      getResolved(): 'light' | 'dark';
      setMode(next: 'light' | 'dark' | 'system'): string;
      apply(): string;
    };
  }
  interface WindowEventMap {
    'sirkuitlab:theme-change': CustomEvent<{
      preference: 'light' | 'dark' | 'system';
      resolved: 'light' | 'dark';
    }>;
  }
}

export {};
