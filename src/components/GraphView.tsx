"use client";

import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useStore } from '../store';
import { Maximize2 } from 'lucide-react';
import { Note } from '../types';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  isOrphan: boolean;
  isActive: boolean;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string;
  target: string;
}

export const GraphView = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { notes, activeNoteId, selectedNoteId, setActiveNote, setSelectedNote } = useStore();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    const nodes: Node[] = notes.map(note => {
      const backlinks = notes.filter(n => n.linksTo.includes(note.id));
      return {
        id: note.id,
        title: note.title,
        isOrphan: note.linksTo.length === 0 && backlinks.length === 0,
        isActive: note.id === selectedNoteId,
      };
    });

    const links: Link[] = [];
    notes.forEach(note => {
      note.linksTo.forEach(targetId => {
        if (notes.some(n => n.id === targetId)) {
          links.push({
            source: note.id,
            target: targetId
          });
        }
      });
    });

    return { nodes, links };
  }, [notes, selectedNoteId]);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("class", "main-group");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    const simulation = d3.forceSimulation<Node>(graphData.nodes)
      .force("link", d3.forceLink<Node, Link>(graphData.links).id(d => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(60));

    simulationRef.current = simulation;

    const link = g.append("g")
      .attr("stroke", "#444444")
      .attr("stroke-opacity", 0.5)
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke-width", 1);

    const node = g.append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedNote(d.id);
      })
      .on("dblclick", (event, d) => {
        setActiveNote(d.id);
      })
      .call(d3.drag<SVGGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    node.append("circle")
      .attr("r", d => d.isActive ? 6 : 4)
      .attr("fill", d => {
        if (d.isActive) return "#a882ff";
        if (d.isOrphan) return "#ef4444"; // red
        return "#ffffff"; // default
      })
      .attr("stroke", d => d.isActive ? "#a882ff" : "none")
      .attr("stroke-width", 2)
      .attr("class", "node-circle transition-all duration-300");

    node.append("text")
      .text(d => d.title)
      .attr("x", 10)
      .attr("y", 4)
      .attr("fill", d => d.isActive ? "#ffffff" : "#999999")
      .attr("font-size", "10px")
      .attr("font-weight", d => d.isActive ? "600" : "400")
      .attr("class", "pointer-events-none select-none");

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    svg.call(zoom.transform, d3.zoomIdentity);

    return () => { simulation.stop(); };
  }, [graphData, setActiveNote, setSelectedNote, dimensions]);

  const handleRecenter = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(750)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  };

  return (
    <div ref={containerRef} className="flex-1 bg-[#1e1e1e] relative overflow-hidden w-full h-full">
      <svg ref={svgRef} className="w-full h-full block" />
      
      <div className="absolute top-6 right-6 flex flex-col gap-2">
        <button 
          onClick={handleRecenter}
          className="p-2 bg-[#2c2c2c] border border-[#3f3f3f] rounded-lg text-[#999999] hover:text-[#ffffff] hover:bg-[#3f3f3f] transition-all shadow-xl"
          title="Recenter Graph"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      <div className="absolute bottom-6 left-6 bg-[#2c2c2c]/80 backdrop-blur-md border border-[#3f3f3f] p-4 rounded-xl text-xs text-[#999999] space-y-2 shadow-2xl pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#a882ff]"></div>
          <span className="font-medium text-[#ffffff]">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></div>
          <span>Imported</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></div>
          <span>Voice</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div>
          <span>Orphan</span>
        </div>
        <div className="pt-2 text-[10px] opacity-40 border-t border-[#3f3f3f] mt-2">
          Double click to open • Drag to move
        </div>
      </div>
    </div>
  );
};
