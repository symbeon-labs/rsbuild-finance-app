import { NextResponse } from "next/server";
import { saveErpExportConfig, setDefaultErpExportConfig, deleteErpExportConfig, type ErpExportConfig } from "@/lib/erp-export-config";
import { type ErpFormat } from "@/lib/erp-export";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organization_id, erp_format, field_mapping, custom_columns, is_default } = body;

    if (!organization_id || !erp_format) {
      return NextResponse.json({ error: "organization_id and erp_format are required" }, { status: 400 });
    }

    const config = await saveErpExportConfig({
      organization_id,
      erp_format,
      field_mapping,
      custom_columns,
      is_default
    });

    if (!config) {
      return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Error saving ERP export config:", error);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { configId } = body;

    if (!configId) {
      return NextResponse.json({ error: "configId is required" }, { status: 400 });
    }

    const success = await setDefaultErpExportConfig(configId);

    if (!success) {
      return NextResponse.json({ error: "Failed to set default config" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting default ERP export config:", error);
    return NextResponse.json({ error: "Failed to set default config" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get("configId");

    if (!configId) {
      return NextResponse.json({ error: "configId is required" }, { status: 400 });
    }

    const success = await deleteErpExportConfig(configId);

    if (!success) {
      return NextResponse.json({ error: "Failed to delete config" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ERP export config:", error);
    return NextResponse.json({ error: "Failed to delete config" }, { status: 500 });
  }
}
