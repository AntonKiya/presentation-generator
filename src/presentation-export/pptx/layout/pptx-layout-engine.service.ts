import { Injectable } from "@nestjs/common";
import {
  PresentationLayoutEngineService,
  resolveCardsColumns,
  resolveGridColumns,
} from "../../../presentation-layout";

@Injectable()
export class PptxLayoutEngineService extends PresentationLayoutEngineService {}

export { resolveCardsColumns, resolveGridColumns };
