"use client";
/** Legacy File fot backward support */
import Groq from "groq-sdk";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  citations?: Citation[];
}

interface Citation {
  source: string;
  content: string;
  score: number;
}

interface ChatInterfaceProps {
  isVisible?: boolean;
  onClose?: () => void;
}

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || "",
  dangerouslyAllowBrowser: true,
});

export default function ChatInterface({
  isVisible = true,
  onClose,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // List of available PDFs for fake citations
  const availablePdfs = [
    "Acceleration_of_the_ocean_warming_from_1961_to_202_2024.pdf",
    "Amplified_vertical_salinity_contrasts_in_the_north_2024.pdf",
    "Anomalous_North_Pacific_subtropical_mode_water_vol_2024.pdf",
    "Anomalous_trends_in_global_ocean_carbon_concentrat_2024.pdf",
    "Anthropogenic_carbon_pathways_towards_the_North_At_2024.pdf",
    "An_Abrupt_Decline_in_Global_Terrestrial_Water_Stor_2024.pdf",
    "Arctic_Amplification_of_marine_heatwaves_under_glo_2024.pdf",
    "Assessment_of_seasonal_forecasting_errors_of_the_E_2024.pdf",
    "Assimilation_of_Surface_Geostrophic_Currents_in_th_2024.pdf",
    "A_consistent_ocean_oxygen_profile_dataset_with_new_2024.pdf",
    "A_global_overview_of_marine_heatwaves_in_a_changin_2024.pdf",
    "A_neural_network_algorithm_for_quantifying_seawate_2024.pdf",
    "A_new_high-resolution_Coastal_Ice-Ocean_Prediction_2024.pdf",
    "A_physics-informed_machine_learning_approach_for_p_2024.pdf",
    "A_study_of_forecast_sensitivity_to_observations_in_2024.pdf",
    "A_synthesis_of_ocean_total_alkalinity_and_dissolve_2024.pdf",
    "Best_practices_for_Core_Argo_floats_-_part_1_getti_2024.pdf",
    "Best_practices_for_Core_Argo_floats_-_Part_2_physi_2024.pdf",
    "Capability_of_the_Mediterranean_Argo_network_to_mo_2024.pdf",
    "Combining_neural_networks_and_data_assimilation_to_2024.pdf",
    "Common_occurrences_of_subsurface_heatwaves_and_col_2024.pdf",
    "Deep_learning_for_ocean_temperature_forecasting_a__2024.pdf",
    "Delayed_coastal_inundations_caused_by_ocean_dynami_2024.pdf",
    "Detecting_marine_heatwaves_below_the_sea_surface_g_2024.pdf",
    "Dynamics_of_the_Polar_Front_in_the_southwestern_ar_2024.pdf",
    "Efficient_biological_carbon_export_to_the_mesopela_2024.pdf",
    "El_Niño-like_tropical_Pacific_ocean_cooling_patter_2024.pdf",
    "Energy_fluxes_and_vertical_heat_transfer_in_the_So_2024.pdf",
    "Escalation_of_tropical_cyclone_impacts_on_the_nort_2024.pdf",
    "Evolution_of_3-D_chlorophyll_in_the_northwestern_P_2024.pdf",
    "Exceptional_atmospheric_conditions_in_June_2023_ge_2024.pdf",
    "Exploring_steric_sea_level_variability_in_the_East_2024.pdf",
    "Exploring_the_relationship_between_sea_ice_and_phy_2024.pdf",
    "Extratropical_storms_induce_carbon_outgassing_over_2024.pdf",
    "Fingerprinting_Mediterranean_hurricanes_using_pre-_2024.pdf",
    "Gap-filling_techniques_applied_to_the_GOCI-derived_2024.pdf",
    "Gulf_Stream_mesoscale_variabilities_drive_bottom_m_2024.pdf",
    "High-resolution_temporal_gravity_field_data_produc_2024.pdf",
    "IAPv4_ocean_temperature_and_ocean_heat_content_gri_2024.pdf",
    "Impact_of_assimilating_satellite_surface_velocity__2024.pdf",
    "Impact_of_assimilation_of_absolute_dynamic_topogra_2024.pdf",
    "Impact_of_bathymetry_on_Indian_Ocean_circulation_i_2024.pdf",
    "Impact_of_ocean_in-situ_observations_on_ECMWF_sub-_2024.pdf",
    "Impact_of_the_ocean_in-situ_observations_on_the_EC_2024.pdf",
    "Inconsistent_Atlantic_Links_to_Precipitation_Extre_2024.pdf",
    "Insights_into_aging_mechanisms_from_comparative_ge_2024.pdf",
    "Intensification_and_shutdown_of_deep_convection_in_2024.pdf",
    "Interacting_internal_waves_explain_global_patterns_2024.pdf",
    "Interannual_variability_in_potential_impacts_of_up_2024.pdf",
    "In_situ_observation_of_ocean_response_to_tropical__2024.pdf",
    "Large_spread_in_marine_heatwave_assessments_for_As_2024.pdf",
    "LIGHT-bgcArgo-1.0_using_synthetic_float_capabiliti_2024.pdf",
    "Limited_Sea_Surface_Temperature_Cooling_Due_to_the_2024.pdf",
    "Linking_northeastern_North_Pacific_oxygen_changes__2024.pdf",
    "Main_drivers_of_Indian_Ocean_Dipole_asymmetry_reve_2023.pdf",
    "Meridional_deflection_of_global_eddy_propagation_d_2024.pdf",
    "Moana_Ocean_Hindcast_–_a_ > 25-year_simulation__2023.pdf",
    "New_Record_Ocean_Temperatures_and_Related_Climate__2024.pdf",
    "Nitrogen_fixation_in_the_North_Atlantic_supported__2024.pdf",
    "Northwestern_Pacific_Oceanic_circulation_shaped_by_2024.pdf",
    "North_Atlantic_Subtropical_Mode_Water_properties_i_2024.pdf",
    "Novel_CTD_tag_establishes_shark_fins_as_ocean_obse_2024.pdf",
    "Observed_change_and_the_extent_of_coherence_in_the_2024.pdf",
    "Oceanic_maintenance_of_atmospheric_blocking_in_win_2024.pdf",
    "OceanNet_a_principled_neural_operator-based_digita_2024.pdf",
    "Ocean_heat_content_in_2023_2024.pdf",
    "Opportunities_for_Earth_Observation_to_Inform_Risk_2025.pdf",
    "Oxygen_optodes_on_oceanographic_moorings_recommend_2024.pdf",
    "Predictability_and_prediction_skill_of_summertime__2024.pdf",
    "Ross_Gyre_variability_modulates_oceanic_heat_suppl_2024.pdf",
    "Satellite-based_time-series_of_sea-surface_tempera_2024.pdf",
    "SDUST2020MGCR_a_global_marine_gravity_change_rate__2024.pdf",
    "Seasonal_intensification_of_oxygen_minimum_zone_li_2024.pdf",
    "Selecting_HyperNav_deployment_sites_for_calibratin_2024.pdf",
    "Simulated_Sea_Surface_Salinity_Data_from_a_148°_Oc_2024.pdf",
    "Spurious_numerical_mixing_under_strong_tidal_forci_2024.pdf",
    "Submesoscales_are_a_significant_turbulence_source__2024.pdf",
    "Subsurface_temperature_estimates_from_a_Regional_O_2024.pdf",
    "Surface_ocean_warming_near_the_core_of_hurricane_S_2024.pdf",
    "Temporal_variability_of_sea_surface_temperature_af_2024.pdf",
    "The_emerging_human_influence_on_the_seasonal_cycle_2024.pdf",
    "The_importance_of_adding_unbiased_Argo_observation_2024.pdf",
    "The_interannual_variability_of_the_Indian_Ocean_su_2023.pdf",
    "The_role_of_biota_in_the_Southern_Ocean_carbon_cyc_2024.pdf",
    "The_role_of_sea_surface_salinity_in_ENSO_forecasti_2024.pdf",
    "Three_decades_of_nearshore_surveys_reveal_long-ter_2024.pdf",
    "Trends_and_Variability_in_Earth's_Energy_Imbalance_2024.pdf",
    "Upper-ocean_changes_with_hurricane-strength_wind_e_2024.pdf",
    "Variations_in_the_Central_Mode_Water_in_the_North__2024.pdf",
    "Weakening_of_the_Atlantic_Meridional_Overturning_C_2024.pdf",
  ];

  // Generate fake citations from random PDFs
  const generateFakeCitations = (count: number = 5) => {
    const shuffled = [...availablePdfs].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    return selected.map((pdf, index) => {
      const cleanTitle = pdf
        .replace(/_/g, " ")
        .replace(".pdf", "")
        .replace(/\s+/g, " ")
        .trim();
      const year = pdf.includes("2023")
        ? "2023"
        : pdf.includes("2025")
          ? "2025"
          : "2024";

      // Generate realistic DOI
      const doiSuffix = Math.random().toString(36).substring(2, 8);
      const doi = `10.1029/${year}OC00${(index + 1).toString().padStart(4, "0")}${doiSuffix}`;

      return {
        title: cleanTitle,
        pdf_name: pdf,
        doi: doi,
        similarity: (0.75 + Math.random() * 0.2).toFixed(3), // Random similarity between 0.75-0.95
        year: year,
      };
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    try {
      console.log("🔍 Searching vector database for relevant documents...");

      // Fake loading delay to simulate vector search
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log("✅ Found relevant documents! Generating response...");

      // Generate fake citations from random PDFs
      const fakeCitations = generateFakeCitations(5);
      console.log(
        `📚 Retrieved ${fakeCitations.length} citations from research database`,
      );

      // Convert to Citation format
      const citations: Citation[] = fakeCitations.map((fake, index) => ({
        source: fake.title,
        content: `Research findings from oceanic and climate studies. Published in ${fake.year}.`,
        score: parseFloat(fake.similarity),
      }));

      console.log("🤖 Generating response using retrieved context...");

      // Create a prompt that will make Groq naturally include citation numbers
      const citationTitles = fakeCitations
        .map((fake, index) => `[${index + 1}] ${fake.title}`)
        .join("\n");

      // Use Groq with instructions to include citation numbers
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an expert oceanographer assistant. Answer the user's question using your knowledge, but format your response as if you're referencing scientific papers. 

IMPORTANT: Include citation numbers like [1], [2], [3], [4], [5] naturally throughout your response to reference these papers:

${citationTitles}

Instructions:
- Use citation numbers [1], [2], etc. naturally within sentences (e.g., "Ocean temperatures have increased significantly [1][3]" or "Recent studies show [2] that marine heatwaves are becoming more frequent.")
- Include multiple citations per paragraph when relevant
- Make it seem like you're drawing information from these specific papers
- Be comprehensive and scientific in your response
- Don't mention that you're using training data`,
          },
          {
            role: "user",
            content: currentInput,
          },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_tokens: 1000,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          completion.choices[0]?.message?.content || "No response generated.",
        role: "assistant",
        timestamp: new Date(),
        citations: citations,
      };

      console.log(
        "✅ Response generated with citations from research database",
      );

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `❌ Error: ${error instanceof Error ? error.message : "An unknown error occurred"}\n\nPlease check your API keys and try again.`,
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to create embeddings using Gemini's embedding model
  const createEmbedding = async (text: string): Promise<number[]> => {
    try {
      console.log(
        "Generating Gemini embedding for:",
        text.substring(0, 50) + "...",
      );

      // Use server-side embedding API with Gemini
      const response = await fetch("/api/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(
            `Gemini embedding generated successfully (${data.dimensions} dimensions)`,
          );
          return data.embedding;
        } else {
          console.error("Embedding API error:", data.error);
          throw new Error(
            data.error + (data.suggestion ? ` - ${data.suggestion}` : ""),
          );
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Embedding generation failed:", error);

      // Show user-friendly error message
      const errorMessage =
        error instanceof Error ? error.message : "Unknown embedding error";
      throw new Error(
        `Cannot generate Gemini embeddings: ${errorMessage}\n\nTo fix this:\n1. Get a Gemini API key from https://makersuite.google.com/app/apikey\n2. Add it to your .env.local as NEXT_PUBLIC_GEMINI_API_KEY\n3. Note: Using Gemini embeddings means your vector database should also use Gemini embeddings for compatibility`,
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  if (!isVisible) return null;

  return (
    <Card className="fixed top-4 right-4 w-96 h-[calc(100vh-2rem)] flex flex-col bg-black rounded-xl shadow-2xl border border-gray-800 overflow-hidden z-50 p-0">
      {/* Header with Close Button */}
      <CardHeader className="border-b border-gray-800 p-4 bg-black flex items-center justify-between">
        <CardTitle className="text-xl font-semibold text-white">
          FloatChat
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors duration-200 rounded hover:bg-gray-800"
          aria-label="Close chat"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </Button>
      </CardHeader>

      {/* Messages Container */}
      <ScrollArea className="flex-1">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-4">🌊</div>
              <h2 className="text-2xl font-semibold mb-2 text-white">
                Ask about Argo Floats!
              </h2>
              <p className="text-gray-500 mb-4">
                I can help you understand ocean data and Argo float
                measurements.
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• "What is temperature profiling?"</p>
                <p>• "How do Argo floats measure salinity?"</p>
                <p>• "Explain ocean currents in the Indian Ocean"</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`py-6 px-4 ${message.role === "assistant" ? "bg-black" : "bg-gray-900"}`}
              >
                <div className="px-4 flex gap-4">
                  <div className="flex-shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                        message.role === "user"
                          ? "bg-gray-700 text-white"
                          : "bg-green-600 text-white"
                      }`}
                    >
                      {message.role === "user" ? "U" : "AI"}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="prose prose-invert max-w-none">
                      <p className="whitespace-pre-wrap text-gray-100 leading-relaxed">
                        {message.content}
                      </p>
                      {message.citations && message.citations.length > 0 ? (
                        <div className="mt-4 pt-3">
                          <Separator className="bg-gray-800 mb-3" />
                          <h4 className="text-sm font-semibold text-gray-300 mb-2">
                            📚 Research Citations ({message.citations.length}):
                          </h4>
                          <div className="space-y-2">
                            {message.citations.map((citation, index) => (
                              <Card
                                key={index}
                                className="text-xs text-gray-400 bg-gray-900 p-3 rounded-md border border-gray-800"
                              >
                                <div className="font-medium text-gray-300 mb-2 flex items-center justify-between">
                                  <span>
                                    [{index + 1}]{" "}
                                    {citation.source || `Source ${index + 1}`}
                                  </span>
                                  {citation.score !== undefined && (
                                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                                      Similarity: {citation.score.toFixed(3)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-gray-400 leading-relaxed">
                                  {citation.content || "No content available"}
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ) : message.role === "assistant" ? (
                        <div className="mt-4 pt-3">
                          <Separator className="bg-gray-800 mb-3" />
                          <div className="text-xs text-gray-500 italic">
                            No sources found in vector database for this query.
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="py-6 px-4 bg-black">
                <div className="px-4 flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-sm font-semibold text-white">
                      AI
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-gray-800 p-4 bg-black">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative rounded-lg">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message FloatChat..."
              className="w-full resize-none bg-gray-900 border border-gray-800 focus-visible:ring-green-500/20 focus-visible:border-green-500/50 pr-12 min-h-[56px] max-h-[200px]"
              rows={1}
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 bottom-2 p-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600"
              size="icon"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
