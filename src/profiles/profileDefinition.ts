import type { ProfileShape } from '../shapes/profileShape';

export interface ProfileDefinition {
  /** Stable identifier persisted in the beam model. */
  id: string;
  /** Display name for pickers. */
  displayName: string;
  /** Grouping category (e.g. "IPE", "HEA"). */
  category?: string;
  /** The shape that generates the cross-section curves. */
  shape: ProfileShape;
  /** Default material name. */
  defaultMaterial?: string;
}
