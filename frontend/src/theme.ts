export const colors = {
  surface: "#041014",
  onSurface: "#F0F9FF",
  surfaceSecondary: "#0A1E24",
  onSurfaceSecondary: "#E0F2FE",
  surfaceTertiary: "#112F38",
  onSurfaceTertiary: "#BAE6FD",
  brand: "#00E5FF",
  onBrand: "#001D23",
  brandSecondary: "#3B82F6",
  brandTertiary: "#0B303B",
  onBrandTertiary: "#38BDF8",
  success: "#34D399",
  onSuccess: "#022C22",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#38BDF8",
  border: "#1E3A42",
  borderStrong: "#2A4D57",
  divider: "#112A32",
  muted: "#5B7683",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

// System fonts with distinct weights (no external font assets required).
export const weight = {
  regular: "400" as const,
  medium: "600" as const,
  bold: "700" as const,
  heavy: "800" as const,
};
