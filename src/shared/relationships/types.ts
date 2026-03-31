/**
 * Card Relationship Types
 *
 * Defines parent/child and blocks/blocked-by relationships between cards.
 * Relationships are stored in spec README.md frontmatter.
 */

export type RelationshipType = 'parent' | 'child' | 'blocks' | 'blocked-by';

export interface CardRelationship {
  sourceId: string;
  targetId: string;
  type: RelationshipType;
}

export interface CardRelationships {
  cardId: string;
  parent?: string;
  children: string[];
  blocks: string[];
  blockedBy: string[];
}
