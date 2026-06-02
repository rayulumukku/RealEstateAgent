"use client";

import { useState } from "react";
import { 
  Building, Upload, FileSpreadsheet, Loader2, 
  CheckCircle, Sparkles, X 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveProjectAction } from "./actions";

interface ParsedUnit {
  number: string;
  config: string;
  size: string;
  price: string;
  status: "AVAILABLE" | "HOLD" | "SOLD" | "BLOCKED";
}

export default function NewProject() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [price, setPrice] = useState("");
  const [propType, setPropType] = useState<"Apartment" | "Plot" | "Villa" | "Commercial">("Apartment");

  const [fileName, setFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parsedUnits, setParsedUnits] = useState<ParsedUnit[]>([]);
  const [step, setStep] = useState(1); // 1: Form, 2: Parsing/Result
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFileName(selectedFile.name);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !location) return;

    setSaving(true);
    const phone = localStorage.getItem("agentsapp_logged_in_phone") || "";
    // Save project with no units for now
    const res = await saveProjectAction(phone, name, location, city, price, propType, []);

    if (res.ok) {
      router.push("/builder/dashboard");
    } else {
      alert("Error saving project: " + res.error);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 text-slate-800">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Create Project</h1>
        <p className="text-[#64748b] text-xs font-semibold mt-0.5">Define project configuration templates and upload Excel spreadsheets.</p>
      </div>

      {/* Form & Upload Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Building className="w-4 h-4 text-indigo-500" />
              <span>Project Schema Configuration</span>
            </h3>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs font-semibold text-slate-400">
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider text-[10px]">Project Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Prestige Heights"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-450 outline-none text-sm font-medium transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider text-[10px]">Location</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Kokapet"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-455 outline-none text-sm font-medium transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider text-[10px]">Property Template</label>
                  <select 
                    value={propType}
                    onChange={(e) => setPropType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-850 outline-none text-sm font-medium transition"
                  >
                    <option>Apartment</option>
                    <option>Plot</option>
                    <option>Villa</option>
                    <option>Commercial</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider text-[10px]">City</label>
                  <input 
                    type="text" 
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 outline-none text-sm font-medium transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider text-[10px]">Price Estimate</label>
                  <input 
                    type="text" 
                    placeholder="e.g. ₹1.82 Cr Onwards"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#25d366] rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-455 outline-none text-sm font-medium transition"
                  />
                </div>
              </div>

              {/* Upload area */}
              <div className="space-y-1.5 pt-2">
                <label className="block uppercase tracking-wider text-[10px]">Excel Spreadsheet Upload</label>
                <div className="relative border border-dashed border-slate-350 hover:border-indigo-500/50 rounded-xl p-8 text-center cursor-pointer transition">
                  <input 
                    type="file" 
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <div className="text-[10px] text-slate-700 font-bold">
                    {fileName ? `Attached: ${fileName}` : "Drag and drop your Excel inventory here"}
                  </div>
                  <div className="text-[8px] text-slate-500 mt-1">Accepts Excel (.xlsx), CSV up to 8MB</div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 text-sm font-bold">
                <Link href="/builder/dashboard" className="px-4 py-2.5 bg-transparent text-slate-500 hover:text-slate-800 rounded-xl transition">
                  Cancel
                </Link>
                <button 
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-70"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
    </div>
  );
}
