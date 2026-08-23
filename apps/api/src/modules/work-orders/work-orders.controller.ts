import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  addWasteSchema, addWorkOrderItemSchema, batchDecisionsSchema, createWorkOrderSchema,
  itemDecisionSchema, partCreateSchema, partUpdateSchema, setMarkDoneSchema, updateStatusSchema,
  AddWasteInput, AddWorkOrderItemInput, BatchDecisionsInput, CreateWorkOrderInput,
  ItemDecisionInput, PartCreateInput, PartUpdateInput, SetMarkDoneInput, UpdateStatusInput,
} from "@autocare/contracts";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { WorkOrdersService } from "./work-orders.service";
import { WorkOrderBillingService } from "./billing.service";
import { RecommendationsService } from "./recommendations.service";
import { PartsService } from "./parts.service";
import { WorkOrderConfigService } from "./config.service";

const thresholdSchema = z.object({ thresholdCentavos: z.number().int().min(0) });

@Controller()
export class WorkOrdersController {
  constructor(
    private workOrders: WorkOrdersService,
    private billing: WorkOrderBillingService,
    private recommendations: RecommendationsService,
    private parts: PartsService,
    private config: WorkOrderConfigService,
  ) {}

  @Post("work-orders")
  create(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(createWorkOrderSchema)) dto: CreateWorkOrderInput) {
    return this.workOrders.create(u, dto);
  }

  @Get("work-orders/:id")
  get(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    return this.workOrders.get(u, id);
  }

  @Post("work-orders/:id/items")
  addItem(@CurrentUser() u: AbilityUser, @Param("id") id: string, @Body(new ZodValidationPipe(addWorkOrderItemSchema)) dto: AddWorkOrderItemInput) {
    return this.workOrders.addItem(u, id, dto);
  }

  @Patch("work-orders/:id/items/:itemId/done")
  markDone(@CurrentUser() u: AbilityUser, @Param("id") id: string, @Param("itemId") itemId: string, @Body(new ZodValidationPipe(setMarkDoneSchema)) dto: SetMarkDoneInput) {
    return this.workOrders.markItemDone(u, id, itemId, dto.done);
  }

  @Post("work-orders/:id/request-approval")
  requestApproval(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    return this.workOrders.requestApproval(u, id);
  }

  @Post("work-orders/:id/items/:itemId/decision")
  decide(@CurrentUser() u: AbilityUser, @Param("id") id: string, @Param("itemId") itemId: string, @Body(new ZodValidationPipe(itemDecisionSchema)) dto: ItemDecisionInput) {
    return this.workOrders.decide(u, id, [{ itemId, decision: dto.decision }]);
  }

  @Post("work-orders/:id/decisions")
  decideBatch(@CurrentUser() u: AbilityUser, @Param("id") id: string, @Body(new ZodValidationPipe(batchDecisionsSchema)) dto: BatchDecisionsInput) {
    return this.workOrders.decide(u, id, dto.decisions);
  }

  @Post("work-orders/:id/waste")
  addWaste(@CurrentUser() u: AbilityUser, @Param("id") id: string, @Body(new ZodValidationPipe(addWasteSchema)) dto: AddWasteInput) {
    return this.workOrders.addWaste(u, id, dto);
  }

  @Patch("work-orders/:id/status")
  async status(@CurrentUser() u: AbilityUser, @Param("id") id: string, @Body(new ZodValidationPipe(updateStatusSchema)) dto: UpdateStatusInput) {
    const result = await this.workOrders.updateStatus(u, id, dto.status, {
      technicianSummary: dto.technicianSummary,
      stockOverrideReason: dto.stockOverrideReason,
    });
    if (dto.status === "CLOSED") {
      await this.billing.issueForClosedWorkOrder(id);
    }
    return result;
  }

  @Get("recommendations")
  recommendationsList(@CurrentUser() u: AbilityUser, @Query("vehicleId") vehicleId: string) {
    return this.recommendations.listForVehicle(u, vehicleId);
  }

  @Get("parts")
  partsSearch(@CurrentUser() u: AbilityUser, @Query("query") query?: string) {
    return this.parts.search(u, query);
  }

  @Get("parts/low-stock")
  lowStock(@CurrentUser() u: AbilityUser) {
    return this.parts.lowStock(u);
  }

  @Post("admin/parts")
  createPart(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(partCreateSchema)) dto: PartCreateInput) {
    return this.parts.create(u, dto);
  }

  @Patch("admin/parts/:sku")
  updatePart(@CurrentUser() u: AbilityUser, @Param("sku") sku: string, @Body(new ZodValidationPipe(partUpdateSchema)) dto: PartUpdateInput) {
    return this.parts.update(u, sku, dto);
  }

  @Get("admin/work-orders/config")
  getConfig(@CurrentUser() u: AbilityUser) {
    return this.config.approvalThresholdCentavos().then((thresholdCentavos) => ({ thresholdCentavos }));
  }

  @Patch("admin/work-orders/config")
  setConfig(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(thresholdSchema)) dto: { thresholdCentavos: number }) {
    return this.config.setApprovalThreshold(u, dto.thresholdCentavos);
  }
}
