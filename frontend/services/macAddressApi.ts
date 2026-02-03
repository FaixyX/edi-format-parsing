"use client"

import { Backend } from "@/lib/helper";
import { MacAddress, NewMacAddress } from "@/types/macAddress";


export async function getMacAddresses():Promise<MacAddress[]> {
      
      const { data } = await Backend.get("authorized-macs" , {
            withCredentials: true
      });


      return data;
}

export async function addMacAddresses(
    mac: NewMacAddress
): Promise<MacAddress[]> {
    try {
        const { data } = await Backend.post("authorized-macs", {
            withCredentials: true,
            body: mac,
        });

        if (data.detail) {
            throw new Error(data.detail);
        }

        return data;
    } catch (error) {
        throw error;
    }
}

export async function updateMacAddresses(
    id: string,
    mac: Partial<MacAddress>
): Promise<MacAddress> {
      const { data } = await Backend.put(`authorized-macs/${id}` , {
            withCredentials: true,
            body: mac
      });

      return data;
}


export async function deleteMacAddresses(id:string):Promise<void> {
       
      await Backend.delete(`authorized-macs/${id}` , {
            withCredentials: true
      });


}



export async function toggleMacStatus(id: string, enabled: boolean):Promise<void> {
      
      await Backend.patch(`authorized-macs/${id}/toggle`, {
            enabled
      } , {
            withCredentials: true
      });

}