import { Module } from "@nestjs/common";
import { SchoolModule } from "../school/school.module.js";
import { AiController } from "./ai.controller.js";
import { AiService } from "./ai.service.js";

@Module({ imports: [SchoolModule], controllers: [AiController], providers: [AiService] })
export class AiModule {}
